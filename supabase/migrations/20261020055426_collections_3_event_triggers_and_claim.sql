create function collect_events_suppressed() returns boolean
language sql stable as $$
  select coalesce(current_setting('collect.suppress_events', true), '') = 'on'
$$;

create function collection_items_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title uuid;
  v_issue uuid := coalesce(new.issue_id, old.issue_id);
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  if collect_events_suppressed() then return null; end if;
  select title_id into v_title from directory_issues where id = v_issue;
  if tg_op = 'INSERT' then
    insert into collection_events (user_id, event_type, title_id, issue_id)
    values (v_user, (new.state || '_added')::collection_event_type, v_title, v_issue);
  elsif tg_op = 'DELETE' then
    insert into collection_events (user_id, event_type, title_id, issue_id)
    values (v_user, (old.state || '_removed')::collection_event_type, v_title, v_issue);
  elsif new.state is distinct from old.state then
    insert into collection_events (user_id, event_type, title_id, issue_id) values
      (v_user, (old.state || '_removed')::collection_event_type, v_title, v_issue),
      (v_user, (new.state || '_added')::collection_event_type, v_title, v_issue);
  end if;
  return null;
end $$;
create trigger collection_items_log
  after insert or update or delete on collection_items
  for each row execute function collection_items_log();

create function collector_titles_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  was_following boolean := case when tg_op = 'INSERT' then false else old.following end;
  was_completing boolean := case when tg_op = 'INSERT' then false else old.completing end;
  is_following boolean := case when tg_op = 'DELETE' then false else new.following end;
  is_completing boolean := case when tg_op = 'DELETE' then false else new.completing end;
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_title uuid := coalesce(new.title_id, old.title_id);
begin
  if collect_events_suppressed() then return null; end if;
  if is_following <> was_following then
    insert into collection_events (user_id, event_type, title_id)
    values (v_user, case when is_following then 'follow_added' else 'follow_removed' end::collection_event_type, v_title);
  end if;
  if is_completing <> was_completing then
    insert into collection_events (user_id, event_type, title_id)
    values (v_user, case when is_completing then 'complete_on' else 'complete_off' end::collection_event_type, v_title);
  end if;
  return null;
end $$;
create trigger collector_titles_log
  after insert or update or delete on collector_titles
  for each row execute function collector_titles_log();

create function availability_requests_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  was_open boolean := tg_op <> 'INSERT' and old.cancelled_at is null and old.fulfilled_at is null;
  is_open boolean := tg_op <> 'DELETE' and new.cancelled_at is null and new.fulfilled_at is null;
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_issue uuid := coalesce(new.issue_id, old.issue_id);
  v_title uuid;
begin
  if collect_events_suppressed() then return null; end if;
  if is_open = was_open then return null; end if;
  if not is_open and tg_op = 'UPDATE' and new.fulfilled_at is not null and old.fulfilled_at is null then
    return null;
  end if;
  select title_id into v_title from directory_issues where id = v_issue;
  insert into collection_events (user_id, event_type, title_id, issue_id)
  values (v_user, case when is_open then 'alert_requested' else 'alert_cancelled' end::collection_event_type, v_title, v_issue);
  return null;
end $$;
create trigger availability_requests_log
  after insert or update or delete on availability_requests
  for each row execute function availability_requests_log();

create function claim_anonymous_activity(
  p_anon_id uuid,
  p_items jsonb default '[]'::jsonb,
  p_titles jsonb default '[]'::jsonb,
  p_first_source text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not signed in'; end if;

  insert into collectors (user_id, first_source, first_anon_id)
  values (v_user, p_first_source, p_anon_id)
  on conflict (user_id) do update set
    first_source = coalesce(collectors.first_source, excluded.first_source),
    first_anon_id = coalesce(collectors.first_anon_id, excluded.first_anon_id);

  perform set_config('collect.suppress_events', 'on', true);

  insert into collection_items (user_id, issue_id, state)
  select v_user, x.issue_id, x.state
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(issue_id uuid, state collection_state)
  join directory_issues i on i.id = x.issue_id
  where x.state is not null
  on conflict (user_id, issue_id) do nothing;

  insert into collector_titles (user_id, title_id, following, completing)
  select v_user, x.title_id, coalesce(x.following, false), coalesce(x.completing, false)
  from jsonb_to_recordset(coalesce(p_titles, '[]'::jsonb)) as x(title_id uuid, following boolean, completing boolean)
  join directory_titles t on t.id = x.title_id
  on conflict (user_id, title_id) do update set
    following = collector_titles.following or excluded.following,
    completing = collector_titles.completing or excluded.completing;

  perform set_config('collect.suppress_events', 'off', true);

  if p_anon_id is not null then
    update collection_events set user_id = v_user
    where anon_id = p_anon_id and user_id is null;
  end if;
end $$;
revoke all on function claim_anonymous_activity(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function claim_anonymous_activity(uuid, jsonb, jsonb, text) to authenticated;;
