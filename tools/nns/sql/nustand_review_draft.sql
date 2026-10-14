-- REVIEW DRAFT ONLY. Deliberately outside supabase/migrations.
-- Apply to a disposable database first. Production execution requires approval.
-- No existing tables are changed. No owner is enrolled by this script.
begin;
create schema nustand_private;
revoke all on schema nustand_private from public, anon, authenticated;
create table nustand_private.owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id)
);
create table nustand_private.prospects (
  id text primary key,
  source jsonb not null check (jsonb_typeof(source) = 'object'),
  review jsonb not null default '{"stage":"New","notes":"","segment":"","fit_score":null,"next_follow_up":"","do_not_contact":false,"contacts":{}}',
  version integer not null default 0,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table nustand_private.review_events (
  id bigint generated always as identity primary key,
  prospect_id text not null references nustand_private.prospects(id),
  actor uuid not null references auth.users(id),
  previous_review jsonb not null,
  next_review jsonb not null,
  version integer not null,
  created_at timestamptz not null default now()
);
alter table nustand_private.owner enable row level security;
alter table nustand_private.prospects enable row level security;
alter table nustand_private.review_events enable row level security;
revoke all on all tables in schema nustand_private from public, anon, authenticated;
revoke all on all sequences in schema nustand_private from public, anon, authenticated;
-- No direct client policies. Only the narrowly scoped owner-checked RPCs below.
create function nustand_private.require_owner() returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) or not exists (
    select 1 from nustand_private.owner where user_id = auth.uid()
  ) then raise exception 'Nustand access denied' using errcode = '42501'; end if;
end $$;
revoke all on function nustand_private.require_owner() from public, anon, authenticated;

create function public.nustand_list() returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  perform nustand_private.require_owner();
  select coalesce(jsonb_agg(jsonb_build_object('source', source, 'review', review, 'version', version) order by source->>'name', id), '[]'::jsonb)
    into result from nustand_private.prospects;
  return result;
end $$;

create function public.nustand_import(records jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog as $$
declare item jsonb; contact jsonb; added integer := 0; inserted integer;
begin
  perform nustand_private.require_owner();
  perform pg_advisory_xact_lock(723407100); -- Serialize the 100-row pilot capacity check.
  if jsonb_typeof(records) is distinct from 'array' or jsonb_array_length(records) not between 1 and 100
     or octet_length(records::text) > 10000000 then raise exception 'Invalid pilot batch'; end if;
  if (select count(distinct r->>'id') from jsonb_array_elements(records) r) <> jsonb_array_length(records) then
    raise exception 'Duplicate prospect IDs';
  end if;
  for item in select value from jsonb_array_elements(records) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') not between 1 and 200
      or jsonb_typeof(item->'name') is distinct from 'string' or length(item->>'name') not between 1 and 500
      or jsonb_typeof(item->'do_not_contact') is distinct from 'boolean'
      or jsonb_typeof(item->'original_record') is distinct from 'object'
      or jsonb_typeof(item->'contacts') is distinct from 'array'
      or jsonb_typeof(item->'job') is distinct from 'object'
      or jsonb_typeof(item->'job'->'status') is distinct from 'string'
      or jsonb_typeof(item->'fit') is distinct from 'object'
      or not (item->'fit' ? 'score')
      or jsonb_typeof(item->'fit'->'score') not in ('number', 'null') then raise exception 'Invalid prospect'; end if;
    if jsonb_array_length(item->'contacts') > 1000 then raise exception 'Too many contacts'; end if;
    if (select count(distinct c->>'id') from jsonb_array_elements(item->'contacts') c) <> jsonb_array_length(item->'contacts') then raise exception 'Duplicate contact IDs'; end if;
    for contact in select value from jsonb_array_elements(item->'contacts') loop
      if jsonb_typeof(contact) is distinct from 'object'
        or jsonb_typeof(contact->'id') is distinct from 'string' or length(contact->>'id') not between 1 and 200
        or coalesce(contact->>'kind', '') not in ('email','phone','instagram')
        or jsonb_typeof(contact->'value') is distinct from 'string' or length(contact->>'value') not between 1 and 500
        or jsonb_typeof(contact->'quality_status') is distinct from 'string'
        or jsonb_typeof(contact->'evidence') is distinct from 'array'
        or jsonb_typeof(contact->'review_reasons') is distinct from 'array' then raise exception 'Invalid contact'; end if;
    end loop;
    insert into nustand_private.prospects (id, source) values (item->>'id', item) on conflict (id) do nothing;
    get diagnostics inserted = row_count;
    added := added + inserted;
  end loop;
  -- Deliberately cap this milestone. Add pagination before expanding the dataset.
  if (select count(*) from nustand_private.prospects) > 100 then raise exception 'Pilot capacity is 100 spaces'; end if;
  return added;
end $$;

create function public.nustand_review(prospect_id text, expected_version integer, next_review jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog as $$
declare current_row nustand_private.prospects%rowtype; decision record;
begin
  perform nustand_private.require_owner();
  select * into current_row from nustand_private.prospects where id = prospect_id for update;
  if not found then raise exception 'Prospect not found'; end if;
  if expected_version is null or current_row.version <> expected_version then raise exception 'This record changed. Reload the workspace before saving.' using errcode = '40001'; end if;
  if jsonb_typeof(next_review) is distinct from 'object'
    or coalesce(next_review->>'stage', '') not in ('New','Reviewing','Qualified','Contacted','Closed')
    or coalesce(next_review->>'segment', 'INVALID') not in ('','Wait','Presence','Dwell','Taste','Catalog')
    or jsonb_typeof(next_review->'notes') is distinct from 'string' or length(next_review->>'notes') > 20000
    or jsonb_typeof(next_review->'next_follow_up') is distinct from 'string'
    or (next_review->>'next_follow_up') !~ '^$|^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(next_review->'do_not_contact') is distinct from 'boolean'
    or jsonb_typeof(next_review->'contacts') is distinct from 'object'
    or not (next_review ? 'fit_score') or jsonb_typeof(next_review->'fit_score') not in ('number','null')
    or exists (select 1 from jsonb_object_keys(next_review) k where k not in ('stage','segment','notes','next_follow_up','do_not_contact','contacts','fit_score'))
    then raise exception 'Invalid review'; end if;
  if next_review->>'next_follow_up' <> '' then perform (next_review->>'next_follow_up')::date; end if;
  if jsonb_typeof(next_review->'fit_score') = 'number' and (
    (next_review->>'fit_score')::numeric < 0 or (next_review->>'fit_score')::numeric > 100 or
    trunc((next_review->>'fit_score')::numeric) <> (next_review->>'fit_score')::numeric
  ) then raise exception 'Invalid fit score'; end if;
  for decision in select key, value from jsonb_each_text(next_review->'contacts') loop
    if decision.value is null or decision.value not in ('accepted','rejected') or not exists (
      select 1 from jsonb_array_elements(current_row.source->'contacts') c where c->>'id' = decision.key
    ) then raise exception 'Invalid contact decision'; end if;
  end loop;
  -- Imported suppression cannot be cleared by a review.
  if current_row.source->>'do_not_contact' = 'true' or current_row.source->'original_record'->>'do_not_contact' = 'true' then
    next_review := jsonb_set(next_review, '{do_not_contact}', 'true');
  end if;
  update nustand_private.prospects set review = next_review, version = version + 1, updated_at = now() where id = prospect_id;
  insert into nustand_private.review_events (prospect_id, actor, previous_review, next_review, version)
    values (prospect_id, auth.uid(), current_row.review, next_review, current_row.version + 1);
  return current_row.version + 1;
end $$;
revoke all on function public.nustand_list() from public, anon;
revoke all on function public.nustand_import(jsonb) from public, anon;
revoke all on function public.nustand_review(text,integer,jsonb) from public, anon;
grant execute on function public.nustand_list() to authenticated;
grant execute on function public.nustand_import(jsonb) to authenticated;
grant execute on function public.nustand_review(text,integer,jsonb) to authenticated;
commit;
-- After approval, enroll the verified auth.users UUID for Gem using the database
-- owner's secure SQL session. Do not infer it from a client-editable email claim.
-- insert into nustand_private.owner(user_id) values ('<verified-owner-uuid>');
