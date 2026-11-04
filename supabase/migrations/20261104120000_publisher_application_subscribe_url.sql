-- Optional "Subscription link" on the publisher application, carried through
-- to the public Index page (directory_titles.subscribe_url, added live in
-- 20261103235839_title_subscribe_url).
--
-- The wizard keeps the value in additional_info.subscribeUrl (both the
-- signed-in update and the anonymous update_publisher_application RPC write
-- the whole form there), so the app works before or after this migration.
-- This migration:
--   1. adds publisher_applications.subscribe_url with the same check as
--      directory_titles.subscribe_url;
--   2. mirrors additional_info.subscribeUrl into that column on every write;
--   3. copies it onto directory_titles.subscribe_url when the approved
--      publisher's magazine is linked to an Index title (directory_neesh_links,
--      written by directory_sync_magazine on approval or by
--      directory_sync_force_link from the admin review queue);
--   4. backfills both for anything submitted before it was applied.

-- 1. Column ------------------------------------------------------------------
alter table public.publisher_applications add column if not exists subscribe_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'publisher_applications_subscribe_url_check'
      and conrelid = 'public.publisher_applications'::regclass
  ) then
    alter table public.publisher_applications
      add constraint publisher_applications_subscribe_url_check
      check (subscribe_url is null or subscribe_url ~* '^https?://');
  end if;
end $$;

-- Same rules as src/lib/subscribe-url.ts: blank is null, a bare domain gets
-- https://, anything that is not http(s) is dropped rather than failing the
-- save.
create or replace function public.normalize_subscribe_url(p_raw text) returns text
language sql immutable set search_path = '' as $$
  select case
    when v is null then null
    when v ~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]+)?([/?#][^[:space:]]*)?$' then v
    else null
  end
  from (
    select case
      when nullif(btrim(p_raw), '') is null then null
      when btrim(p_raw) ~* '^[a-z][a-z0-9+.-]*://' then btrim(p_raw)
      else 'https://' || ltrim(btrim(p_raw), '/')
    end as v
  ) s
$$;

-- 2. Mirror additional_info.subscribeUrl into the column -----------------------
create or replace function public.publisher_application_subscribe_url() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.additional_info) = 'object' and new.additional_info ? 'subscribeUrl' then
    new.subscribe_url := public.normalize_subscribe_url(new.additional_info->>'subscribeUrl');
  end if;
  return new;
end $$;

drop trigger if exists trg_publisher_application_subscribe_url on public.publisher_applications;
create trigger trg_publisher_application_subscribe_url
  before insert or update of additional_info on public.publisher_applications
  for each row execute function public.publisher_application_subscribe_url();

-- 3. Copy onto the Index title when the claim is linked ------------------------
-- Finds the application the same way directory_sync_magazine does (by the
-- publisher's user, then email), approved first. Only a non-empty link is
-- copied, so a blank field never clears a link Neesh already has on file.
create or replace function public.directory_sync_subscribe_url() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_url text;
begin
  begin
    select a.subscribe_url into v_url
    from public.magazines mm
    join public.publishers pp on pp.id = mm.publisher_id
    left join public.users u on u.id = pp.user_id
    join public.publisher_applications a
      on a.user_id = pp.user_id or (u.email is not null and lower(a.email) = lower(u.email))
    where mm.id = new.magazine_id
      and a.status = 'approved'
      and a.subscribe_url is not null
    order by a.reviewed_at desc nulls last, a.created_at desc
    limit 1;

    if v_url is not null then
      update public.directory_titles
        set subscribe_url = v_url
        where id = new.title_id and subscribe_url is distinct from v_url;
    end if;
  exception when others then
    -- Linking must never fail because of the subscription link.
    raise notice 'directory_sync_subscribe_url failed for magazine %: %', new.magazine_id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_directory_sync_subscribe_url on public.directory_neesh_links;
create trigger trg_directory_sync_subscribe_url
  after insert or update of title_id on public.directory_neesh_links
  for each row execute function public.directory_sync_subscribe_url();

-- 4. Backfill ------------------------------------------------------------------
update public.publisher_applications
  set subscribe_url = public.normalize_subscribe_url(additional_info->>'subscribeUrl')
  where jsonb_typeof(additional_info) = 'object'
    and nullif(btrim(additional_info->>'subscribeUrl'), '') is not null
    and subscribe_url is distinct from public.normalize_subscribe_url(additional_info->>'subscribeUrl');

-- Titles already linked to an approved application that has a link. Leaves a
-- title alone if it already has a subscribe_url.
update public.directory_titles t
  set subscribe_url = x.subscribe_url
  from (
    select distinct on (l.title_id) l.title_id, a.subscribe_url
    from public.directory_neesh_links l
    join public.magazines mm on mm.id = l.magazine_id
    join public.publishers pp on pp.id = mm.publisher_id
    left join public.users u on u.id = pp.user_id
    join public.publisher_applications a
      on a.user_id = pp.user_id or (u.email is not null and lower(a.email) = lower(u.email))
    where a.status = 'approved' and a.subscribe_url is not null
    order by l.title_id, a.reviewed_at desc nulls last, a.created_at desc
  ) x
  where t.id = x.title_id and t.subscribe_url is null;
