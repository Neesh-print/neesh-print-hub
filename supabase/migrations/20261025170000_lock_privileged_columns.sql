-- Lock the columns that grant access or money (October 2026 audit).
--
-- Several "can update own row" policies had no column limits, so through
-- the REST API a signed-in user could:
--   * users:      set their own role to 'admin' (is_admin() and every admin
--                 policy read users.role);
--   * publishers: approve their own application, on a row they update or
--                 insert themselves;
--   * retailers:  turn on net terms and set their own credit limit;
--   * orders:     as an approved publisher, change anything on an order for
--                 their magazines (price, payment status, retailer), since
--                 the update policy had no WITH CHECK.
--
-- Each table gets a BEFORE trigger that lets the service role, direct
-- database sessions and admins through, and otherwise rejects changes to
-- the privileged columns. The app only ever writes these columns from edge
-- functions (service role) or admin pages, so no normal flow changes.
-- The guards run before the other BEFORE triggers on each table (trigger
-- names sort first), so they see exactly what the caller sent.

-- Shared: who is calling ------------------------------------------------------

create or replace function public.request_is_privileged()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
begin
  -- '' is a direct database session (migrations, SQL editor, cron);
  -- service_role is an edge function or server.
  return jwt_role in ('', 'service_role') or public.is_admin();
end $$;

revoke all on function public.request_is_privileged() from public, anon;
grant execute on function public.request_is_privileged() to authenticated, service_role;

-- users: only username may change -------------------------------------------

create or replace function public.guard_users_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.request_is_privileged() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.password_hash is distinct from old.password_hash
     or new.email_verified is distinct from old.email_verified
     or new.is_demo is distinct from old.is_demo
     or new.created_at is distinct from old.created_at then
    raise exception 'Only your username can be changed here' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a_guard_users_columns on public.users;
create trigger a_guard_users_columns
  before update on public.users
  for each row execute function public.guard_users_columns();

-- publishers: review, payout and stats columns ------------------------------

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
       or coalesce(new.stripe_payouts_enabled, false) then
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
     or new.average_rating is distinct from old.average_rating then
    raise exception 'These publisher fields are managed by Neesh' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a_guard_publishers_columns on public.publishers;
create trigger a_guard_publishers_columns
  before insert or update on public.publishers
  for each row execute function public.guard_publishers_columns();

-- retailers: terms, credit and stats columns --------------------------------

create or replace function public.guard_retailers_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.request_is_privileged() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.payment_terms_enabled is distinct from old.payment_terms_enabled
     or new.net_terms_days is distinct from old.net_terms_days
     or new.terms_status is distinct from old.terms_status
     or new.credit_limit is distinct from old.credit_limit
     or new.terms_approved_at is distinct from old.terms_approved_at
     or new.terms_approved_by is distinct from old.terms_approved_by
     or new.verified is distinct from old.verified
     or new.verified_at is distinct from old.verified_at
     or new.total_orders is distinct from old.total_orders
     or new.total_spent is distinct from old.total_spent
     or new.average_rating is distinct from old.average_rating then
    raise exception 'These retailer fields are managed by Neesh' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a_guard_retailers_columns on public.retailers;
create trigger a_guard_retailers_columns
  before update on public.retailers
  for each row execute function public.guard_retailers_columns();

-- orders: publishers may only mark processing/shipped and add tracking -------

drop policy if exists "Approved publishers can update their orders" on public.orders;
create policy "Approved publishers can update their orders" on public.orders
  for update
  using (magazine_id in (
    select m.id from public.magazines m join public.publishers p on m.publisher_id = p.id
    where p.user_id = auth.uid() and p.application_status = 'approved'))
  with check (magazine_id in (
    select m.id from public.magazines m join public.publishers p on m.publisher_id = p.id
    where p.user_id = auth.uid() and p.application_status = 'approved'));

create or replace function public.guard_orders_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed text[] := array['status', 'tracking_number', 'carrier', 'updated_at'];
begin
  if public.request_is_privileged() then
    return new;
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Publishers can only update the status and tracking of an order' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not (old.status in ('paid', 'processing', 'shipped') and new.status in ('processing', 'shipped')) then
    raise exception 'Publishers can mark an order processing or shipped' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists a_guard_orders_columns on public.orders;
create trigger a_guard_orders_columns
  before update on public.orders
  for each row execute function public.guard_orders_columns();
