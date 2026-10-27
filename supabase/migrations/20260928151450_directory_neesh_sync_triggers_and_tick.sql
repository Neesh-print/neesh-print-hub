
-- Marketplace writes must never fail because of the Index, so errors land in the queue.
create or replace function public.directory_sync_on_magazine() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.directory_sync_magazine(new.id);
  exception when others then
    insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason)
      values (new.id, new.publisher_id, 'error', left(sqlerrm, 500)) on conflict do nothing;
  end;
  return new;
end $$;

drop trigger if exists trg_directory_sync_magazine on public.magazines;
create trigger trg_directory_sync_magazine
  after insert or update of is_active, is_demo, title, publisher_id, cover_image_url on public.magazines
  for each row execute function public.directory_sync_on_magazine();

create or replace function public.directory_sync_on_publisher() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from public.magazines where publisher_id = new.id order by created_at loop
    begin
      perform public.directory_sync_magazine(r.id);
    exception when others then
      insert into public.directory_sync_queue (magazine_id, neesh_publisher_id, kind, reason)
        values (r.id, new.id, 'error', left(sqlerrm, 500)) on conflict do nothing;
    end;
  end loop;
  return new;
end $$;

drop trigger if exists trg_directory_sync_publisher on public.publishers;
create trigger trg_directory_sync_publisher
  after update of application_status on public.publishers
  for each row when (old.application_status is distinct from new.application_status)
  execute function public.directory_sync_on_publisher();

-- When a listing is deleted its link goes with it; recheck the title.
create or replace function public.directory_sync_on_link_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.directory_sync_refresh_title(old.title_id);
  return old;
end $$;
drop trigger if exists trg_directory_sync_link_delete on public.directory_neesh_links;
create trigger trg_directory_sync_link_delete after delete on public.directory_neesh_links
  for each row execute function public.directory_sync_on_link_delete();

-- Close review items automatically once the copy is rewritten or a niche is added.
create or replace function public.directory_sync_resolve_copy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.directory_sync_queue set status = 'resolved', resolved_at = now()
    where title_id = new.id and kind = 'needs_copy' and status = 'open';
  return new;
end $$;
drop trigger if exists trg_directory_sync_resolve_copy on public.directory_titles;
create trigger trg_directory_sync_resolve_copy after update of description on public.directory_titles
  for each row when (old.description is distinct from new.description)
  execute function public.directory_sync_resolve_copy();

create or replace function public.directory_sync_resolve_tags() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.directory_sync_queue set status = 'resolved', resolved_at = now()
    where title_id = new.title_id and kind = 'needs_tags' and status = 'open';
  return new;
end $$;
drop trigger if exists trg_directory_sync_resolve_tags on public.directory_title_tags;
create trigger trg_directory_sync_resolve_tags after insert on public.directory_title_tags
  for each row execute function public.directory_sync_resolve_tags();

-- Every 15 minutes: rehost any pending covers, and email Gem anything new in the review queue.
create or replace function public.directory_sync_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_body text; v_n int; v_key text; v_from text;
begin
  if exists (select 1 from public.directory_cover_sources where not fetched and error is null) then
    perform net.http_post(
      url := 'https://smfzrubkyxejzkblrrjr.supabase.co/functions/v1/rehost-covers',
      body := '{"limit":15}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZnpydWJreXhlanprYmxycmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3Nzc1MTcsImV4cCI6MjA2ODM1MzUxN30.1DF1Gtz3rIH0ifyeu0IUSKZmIy4LFnA1ddEtYjLSO0w'),
      timeout_milliseconds := 60000);
  end if;

  select array_agg(q.id), count(*),
    string_agg(
      case q.kind when 'needs_decision' then 'Needs a decision' when 'needs_copy' then 'Rewrite description'
                  when 'needs_tags' then 'Needs a niche' else 'Sync error' end
      || E'\n  ' || coalesce(pp.company_name, '') || coalesce(' / ' || nullif(btrim(mm.title), ''), '')
      || E'\n  ' || coalesce(q.reason, '')
      || coalesce(E'\n  https://neesh.art/titles/' || t.slug, '')
      || coalesce(E'\n  Possible matches: ' || (select string_agg(c->>'name', ', ') from jsonb_array_elements(q.candidates) c), ''),
      E'\n\n' order by q.kind, q.created_at)
  into v_ids, v_n, v_body
  from public.directory_sync_queue q
  left join public.publishers pp on pp.id = q.neesh_publisher_id
  left join public.magazines mm on mm.id = q.magazine_id
  left join public.directory_titles t on t.id = q.title_id
  where q.status = 'open' and q.notified_at is null;

  if v_ids is null then return; end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'RESEND_API_KEY';
  select decrypted_secret into v_from from vault.decrypted_secrets where name = 'NOTIFICATION_FROM_EMAIL';
  if v_key is null then return; end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', coalesce(nullif(v_from, ''), 'Neesh <hi@neesh.art>'),
      'to', jsonb_build_array('gem@neesh.art'),
      'subject', 'Index sync, ' || v_n || case when v_n = 1 then ' item' else ' items' end || ' to review',
      'text', 'New Neesh listings the Index sync could not finish on its own.' || E'\n\n' || v_body));

  update public.directory_sync_queue set notified_at = now() where id = any(v_ids);
end $$;

revoke all on function public.directory_sync_on_magazine() from public, anon, authenticated;
revoke all on function public.directory_sync_on_publisher() from public, anon, authenticated;
revoke all on function public.directory_sync_on_link_delete() from public, anon, authenticated;
revoke all on function public.directory_sync_resolve_copy() from public, anon, authenticated;
revoke all on function public.directory_sync_resolve_tags() from public, anon, authenticated;
revoke all on function public.directory_sync_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'directory-sync-tick';
select cron.schedule('directory-sync-tick', '*/15 * * * *', $$select public.directory_sync_tick()$$);
;
