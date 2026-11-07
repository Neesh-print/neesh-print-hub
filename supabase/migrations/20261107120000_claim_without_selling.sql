-- Claim your title without selling (spec, Nov 6 2026).
--
-- Claiming an Index page and selling on Neesh used to be the same flow.
-- From here on claiming is free and separate; selling is an explicit,
-- recorded opt-in that only Neesh can switch on (after review).
--
--   1. publishers.sells_on_neesh / sell_opt_in_at. Every existing publisher
--      came through the selling application, so all of them start as sellers
--      and nothing changes for them.
--   2. publisher_applications.wants_to_sell, mirrored from
--      additional_info.wantsToSell (the anonymous save RPC writes the whole
--      form into additional_info, so no RPC change is needed).
--   3. sells_on_neesh and sell_opt_in_at join the privileged publisher
--      columns, so a publisher can't opt themselves in.
--   4. Marketplace guard, enforced in the database: a non-seller's magazines
--      are kept inactive and are not readable by anyone but the owner and
--      admins. create-checkout, create-net-order and the shipping quote also
--      check sells_on_neesh themselves (they run as the service role).
--   5. directory_claim_for_account(): marks an Index publisher claimed for a
--      claim-only account, used by approve-application.

-- 1. Publisher columns ---------------------------------------------------------
-- Added with default true so every existing row is a seller, then the default
-- drops to false for new publishers.
alter table public.publishers
  add column if not exists sells_on_neesh boolean not null default true;
alter table public.publishers
  alter column sells_on_neesh set default false;
alter table public.publishers
  add column if not exists sell_opt_in_at timestamptz;

update public.publishers
  set sell_opt_in_at = coalesce(verified_at, reviewed_at, created_at)
  where sells_on_neesh and sell_opt_in_at is null;

comment on column public.publishers.sells_on_neesh is
  'True once Neesh has approved this publisher to sell. Claim-only publishers are false. Service role and admins only.';
comment on column public.publishers.sell_opt_in_at is
  'When selling was approved (backfilled from the approval date for publishers who joined before claim-only existed).';

-- 2. Application answer --------------------------------------------------------
alter table public.publisher_applications
  add column if not exists wants_to_sell boolean;

comment on column public.publisher_applications.wants_to_sell is
  'Answer to "Do you want to sell on Neesh?". Null until answered.';

create or replace function public.publisher_application_wants_to_sell() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.additional_info) = 'object' and new.additional_info ? 'wantsToSell' then
    new.wants_to_sell := case jsonb_typeof(new.additional_info->'wantsToSell')
      when 'boolean' then (new.additional_info->>'wantsToSell')::boolean
      else null
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_publisher_application_wants_to_sell on public.publisher_applications;
create trigger trg_publisher_application_wants_to_sell
  before insert or update of additional_info on public.publisher_applications
  for each row execute function public.publisher_application_wants_to_sell();

-- Everything already submitted, approved or rejected went through the selling
-- steps. Drafts stay null, so they get the question when they resume.
update public.publisher_applications
  set wants_to_sell = true
  where wants_to_sell is null and status in ('submitted', 'pending', 'approved', 'rejected');

-- 3. Lock the new columns --------------------------------------------------------
-- Same as 20261025170000_lock_privileged_columns.sql, plus sells_on_neesh and
-- sell_opt_in_at on both insert and update.
create or replace function public.guard_publishers_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.request_is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.application_status::text, 'draft') not in ('draft', 'submitted')
       or coalesce(new.verified, false)
       or new.verified_at is not null
       or new.reviewed_at is not null
       or new.reviewed_by is not null
       or new.stripe_account_id is not null
       or coalesce(new.stripe_charges_enabled, false)
       or coalesce(new.stripe_payouts_enabled, false)
       or coalesce(new.sells_on_neesh, false)
       or new.sell_opt_in_at is not null then
      raise exception 'New publisher records start as a draft application' using errcode = '42501';
    end if;
    return new;
  end if;

  -- An owner may move their own application between draft and submitted.
  if new.application_status is distinct from old.application_status
     and not (coalesce(old.application_status::text, 'draft') in ('draft', 'submitted')
              and new.application_status::text in ('draft', 'submitted')) then
    raise exception 'Applications are approved or rejected by Neesh' using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     or new.verified is distinct from old.verified
     or new.verified_at is distinct from old.verified_at
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.rejection_reason is distinct from old.rejection_reason
     or new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_account_created_at is distinct from old.stripe_account_created_at
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
     or new.stripe_details_submitted is distinct from old.stripe_details_submitted
     or new.stripe_requirements_due is distinct from old.stripe_requirements_due
     or new.stripe_status_updated_at is distinct from old.stripe_status_updated_at
     or new.total_sales is distinct from old.total_sales
     or new.average_rating is distinct from old.average_rating
     or new.sells_on_neesh is distinct from old.sells_on_neesh
     or new.sell_opt_in_at is distinct from old.sell_opt_in_at then
    raise exception 'These publisher fields are managed by Neesh' using errcode = '42501';
  end if;
  return new;
end $$;

-- 4. Marketplace guard -----------------------------------------------------------
create or replace function public.publisher_sells_on_neesh(p_publisher uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pp.sells_on_neesh from public.publishers pp where pp.id = p_publisher), false)
$$;

revoke all on function public.publisher_sells_on_neesh(uuid) from public;
grant execute on function public.publisher_sells_on_neesh(uuid) to anon, authenticated, service_role;

-- A non-seller's magazine can exist (a claim-only publisher may add titles in
-- the portal) but is never active, whoever writes it. Named to run before the
-- other BEFORE triggers on magazines.
create or replace function public.guard_magazines_marketplace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(new.is_active, false) and not public.publisher_sells_on_neesh(new.publisher_id) then
    new.is_active := false;
  end if;
  return new;
end $$;

drop trigger if exists a_guard_magazines_marketplace on public.magazines;
create trigger a_guard_magazines_marketplace
  before insert or update on public.magazines
  for each row execute function public.guard_magazines_marketplace();

-- If Neesh ever switches selling off for a publisher, take their titles off
-- the marketplace at the same time.
create or replace function public.publishers_selling_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.sells_on_neesh and not new.sells_on_neesh then
    update public.magazines set is_active = false
      where publisher_id = new.id and is_active;
  end if;
  return new;
end $$;

drop trigger if exists trg_publishers_selling_off on public.publishers;
create trigger trg_publishers_selling_off
  after update of sells_on_neesh on public.publishers
  for each row execute function public.publishers_selling_off();

-- Belt and braces on reads: every existing SELECT policy on magazines is
-- permissive, so this restrictive one is ANDed with all of them. Owners and
-- admins still see their own rows. The check lives in one security-definer
-- function so anonymous readers don't need execute on is_admin().
create or replace function public.magazine_readable_in_marketplace(p_publisher uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.publisher_sells_on_neesh(p_publisher)
      or coalesce(public.is_admin(), false)
      or exists (
        select 1 from public.publishers pp
        where pp.id = p_publisher and auth.uid() is not null and pp.user_id = auth.uid()
      )
$$;

revoke all on function public.magazine_readable_in_marketplace(uuid) from public;
grant execute on function public.magazine_readable_in_marketplace(uuid) to anon, authenticated, service_role;

drop policy if exists "Marketplace shows sellers only" on public.magazines;
create policy "Marketplace shows sellers only"
  on public.magazines
  as restrictive
  for select
  to public
  using (public.magazine_readable_in_marketplace(publisher_id));

-- 5. Claim an Index page for a claim-only account ---------------------------------
-- Marks the Index publisher behind p_title_slug claimed with p_email as
-- claimed_email, which is what directory_owned_publisher_ids() uses to give
-- the account edit rights (no magazines row needed). With no slug (the
-- applicant added a title that wasn't in the Index yet) it creates the Index
-- publisher and title, claimed. Refuses a page someone else already claimed.
-- Returns the Index publisher id.
create or replace function public.directory_claim_for_account(
  p_title_slug text,
  p_email text,
  p_publisher_name text,
  p_title_name text,
  p_website text default null,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dp uuid;
  v_claimed boolean;
  v_claimed_email text;
  v_removed boolean;
  v_name text := nullif(btrim(coalesce(p_publisher_name, '')), '');
  v_title text := nullif(btrim(coalesce(p_title_name, '')), '');
begin
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'An email is needed to claim an Index page';
  end if;

  if nullif(btrim(coalesce(p_title_slug, '')), '') is not null then
    select t.publisher_id into v_dp
      from public.directory_titles t
      where t.slug = btrim(p_title_slug);
    if v_dp is null then
      raise exception 'No Index title with slug %', p_title_slug;
    end if;

    select dp.claimed, dp.claimed_email, dp.removed
      into v_claimed, v_claimed_email, v_removed
      from public.directory_publishers dp where dp.id = v_dp;
    if v_removed then
      raise exception 'That Index page was removed; restore it before approving the claim';
    end if;
    if v_claimed and v_claimed_email is not null and lower(v_claimed_email) <> lower(p_email) then
      raise exception 'That Index page is already claimed by another email (%)', v_claimed_email;
    end if;

    update public.directory_publishers set
      claim_method = coalesce(claim_method, 'neesh_account'),
      claimed = true,
      claimed_at = coalesce(claimed_at, now()),
      claimed_email = p_email,
      contact_email = coalesce(contact_email, p_email),
      website = coalesce(website, nullif(btrim(coalesce(p_website, '')), ''))
    where id = v_dp;
    return v_dp;
  end if;

  -- New to the Index.
  if v_name is null and v_title is null then
    raise exception 'A publisher or title name is needed to add a new Index page';
  end if;
  v_name := coalesce(v_name, v_title);
  v_title := coalesce(v_title, v_name);

  insert into public.directory_publishers
    (name, slug, website, contact_email, eligible, claimed, claimed_at, claimed_email, claim_method, created_from)
  values
    (v_name, public.directory_sync_unique_slug(v_name, 'publishers'),
     nullif(btrim(coalesce(p_website, '')), ''), p_email, true, true, now(), p_email, 'neesh_account', 'admin_created')
  returning id into v_dp;

  insert into public.directory_titles (publisher_id, name, slug, description, status, created_from)
  values (v_dp, v_title, public.directory_sync_unique_slug(v_title, 'titles'),
          nullif(btrim(coalesce(p_description, '')), ''), 'active', 'admin_created');

  return v_dp;
end $$;

revoke all on function public.directory_claim_for_account(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.directory_claim_for_account(text, text, text, text, text, text) to service_role;
