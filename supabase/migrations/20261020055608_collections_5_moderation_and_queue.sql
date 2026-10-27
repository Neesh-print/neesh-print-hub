create function content_reports_flag() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  open_count int;
begin
  select count(*) into open_count from content_reports
  where target_id = new.target_id and target_kind = new.target_kind and resolved_at is null;
  if open_count >= 2 then
    if new.target_kind = 'issue' then
      update directory_issues set review_status = 'flagged' where id = new.target_id and review_status <> 'rejected';
    elsif new.target_kind = 'title' then
      update directory_titles set review_status = 'flagged' where id = new.target_id and review_status <> 'rejected';
    elsif new.target_kind = 'publisher' then
      update directory_publishers set review_status = 'flagged' where id = new.target_id and review_status <> 'rejected';
    elsif new.target_kind = 'variant' then
      update directory_issue_variants set review_status = 'flagged' where id = new.target_id and review_status <> 'rejected';
    end if;
  end if;
  return null;
end $$;
create trigger content_reports_flag
  after insert on content_reports
  for each row execute function content_reports_flag();

create function reader_rejections_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rejected int;
begin
  if new.created_by is null or new.created_from <> 'reader_created'
     or new.review_status <> 'rejected' or old.review_status = 'rejected' then
    return null;
  end if;
  select (select count(*) from directory_issues where created_by = new.created_by and created_from = 'reader_created' and review_status = 'rejected')
       + (select count(*) from directory_titles where created_by = new.created_by and created_from = 'reader_created' and review_status = 'rejected')
       + (select count(*) from directory_publishers where created_by = new.created_by and created_from = 'reader_created' and review_status = 'rejected')
    into rejected;
  if rejected >= 3 then
    update collectors set can_add = false where user_id = new.created_by;
  end if;
  return null;
end $$;
create trigger directory_issues_rejections after update of review_status on directory_issues
  for each row execute function reader_rejections_check();
create trigger directory_titles_rejections after update of review_status on directory_titles
  for each row execute function reader_rejections_check();
create trigger directory_publishers_rejections after update of review_status on directory_publishers
  for each row execute function reader_rejections_check();

create function orders_report_issue_availability() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return null; end if;
  insert into directory_issue_availability (issue_id, store_id, level, source, source_note, observed_on)
  select i.id, c.store_id, 'reported', 'neesh_order', 'Neesh order ' || new.id, current_date
  from directory_issues i
  join directory_store_claims c on c.retailer_id = new.retailer_id and c.status = 'approved'
  where i.neesh_magazine_id = new.magazine_id and not i.removed and i.merged_into is null;
  return null;
end $$;
create trigger orders_report_issue_availability
  after update of status on orders
  for each row execute function orders_report_issue_availability();

create view directory_review_queue as
select 'issue' as kind, id, title_id as parent_id, issue_label as label, source_url,
  cover_image_path, review_status, created_from, created_by, created_at,
  (select count(*) from content_reports r where r.target_id = i.id and r.resolved_at is null) as open_reports
  from directory_issues i
  where merged_into is null and (review_status in ('pending', 'flagged')
    or exists (select 1 from content_reports r where r.target_id = i.id and r.resolved_at is null))
union all
select 'title', id, publisher_id, name, null, cover_image_path, review_status, created_from, created_by, created_at,
  (select count(*) from content_reports r where r.target_id = t.id and r.resolved_at is null)
  from directory_titles t
  where merged_into is null and (review_status in ('pending', 'flagged')
    or exists (select 1 from content_reports r where r.target_id = t.id and r.resolved_at is null))
union all
select 'publisher', id, null, name, website, null, review_status, created_from, created_by, created_at,
  (select count(*) from content_reports r where r.target_id = p.id and r.resolved_at is null)
  from directory_publishers p
  where merged_into is null and (review_status in ('pending', 'flagged')
    or exists (select 1 from content_reports r where r.target_id = p.id and r.resolved_at is null))
union all
select 'variant', id, issue_id, label, source_url, cover_image_path, review_status, created_from, created_by, created_at,
  (select count(*) from content_reports r where r.target_id = v.id and r.resolved_at is null)
  from directory_issue_variants v
  where review_status in ('pending', 'flagged')
    or exists (select 1 from content_reports r where r.target_id = v.id and r.resolved_at is null)
order by created_at;
revoke all on directory_review_queue from anon, authenticated;

create function get_directory_review_queue() returns setof directory_review_queue
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then raise exception 'admin only'; end if;
  return query select * from directory_review_queue;
end $$;
revoke all on function get_directory_review_queue() from public, anon;
grant execute on function get_directory_review_queue() to authenticated;

create function review_directory_record(
  p_kind text, p_id uuid, p_status review_status,
  p_note text default null, p_source_url text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;
  if p_kind = 'issue' then
    update directory_issues set review_status = p_status, reviewed_at = now(),
      review_note = coalesce(p_note, review_note),
      source_url = coalesce(p_source_url, source_url),
      verified_at = case when p_status = 'approved' then now() else verified_at end
    where id = p_id;
  elsif p_kind = 'title' then
    update directory_titles set review_status = p_status, reviewed_at = now(),
      review_note = coalesce(p_note, review_note),
      verified_at = case when p_status = 'approved' then now() else verified_at end
    where id = p_id;
  elsif p_kind = 'publisher' then
    update directory_publishers set review_status = p_status, reviewed_at = now(),
      review_note = coalesce(p_note, review_note),
      website = coalesce(website, p_source_url)
    where id = p_id;
  elsif p_kind = 'variant' then
    update directory_issue_variants set review_status = p_status,
      source_url = coalesce(p_source_url, source_url)
    where id = p_id;
  else
    raise exception 'unknown kind %', p_kind;
  end if;
  if p_status in ('approved', 'rejected') then
    update content_reports set resolved_at = now()
    where target_kind = p_kind and target_id = p_id and resolved_at is null;
  end if;
end $$;
revoke all on function review_directory_record(text, uuid, review_status, text, text) from public, anon;
grant execute on function review_directory_record(text, uuid, review_status, text, text) to authenticated;

create function directory_similar_titles(p_name text)
returns table (id uuid, name text, slug text, publisher_name text, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select t.id, t.name, t.slug, p.name, extensions.similarity(t.name, p_name)
  from directory_titles t join directory_publishers p on p.id = t.publisher_id
  where extensions.similarity(t.name, p_name) > 0.6
  order by 5 desc limit 5
$$;
create function directory_similar_issues(p_title_id uuid, p_label text)
returns table (id uuid, issue_label text, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select i.id, i.issue_label, extensions.similarity(i.issue_label, p_label)
  from directory_issues i
  where i.title_id = p_title_id and extensions.similarity(i.issue_label, p_label) > 0.6
  order by 3 desc limit 5
$$;
create function directory_similar_publishers(p_name text)
returns table (id uuid, name text, slug text, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select p.id, p.name, p.slug, extensions.similarity(p.name, p_name)
  from directory_publishers p
  where extensions.similarity(p.name, p_name) > 0.6
  order by 4 desc limit 5
$$;;
