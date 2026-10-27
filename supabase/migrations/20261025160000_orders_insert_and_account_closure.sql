-- Security and account fixes from the October 2026 audit (items 34-36).
--
-- 1. Orders: any signed-in user could insert an order for themselves
--    through the REST API, and orders.payment_status defaults to 'paid', so
--    the row showed up to the publisher as a paid order with no payment.
--    Orders are only ever created by edge functions with the service role
--    (stripe-webhook, create-net-order), so the client insert policies go.
--    (The default itself changes in 20261025160100, after the webhook that
--    relied on it is deployed.)
--
-- 2. Account closure: delete-user-data deleted public.users and publishers
--    rows, which cascades to orders, payment sessions and payout transfers.
--    The privacy policy keeps transaction and payout records for seven years.
--    close_user_account() de-identifies instead, in one transaction: it keeps
--    the rows those records hang off, strips the personal details from them,
--    deletes data that is only personal, and refuses while orders are open,
--    invoices unpaid or payouts pending. The edge function deletes the auth
--    user (the login) afterwards.
--
-- 3. Retailer email verification: tokens never expired. A send timestamp
--    lets verify-retailer-email reject tokens older than seven days and
--    rate-limit resends; the column is protected like the token itself.

-- 1. Orders --------------------------------------------------------------------

drop policy if exists "Retailers can create orders" on public.orders;
drop policy if exists "Retailers can create their own orders" on public.orders;

-- 2. Account closure -------------------------------------------------------------

create or replace function public.close_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_retailer_id uuid;
  v_publisher_id uuid;
  v_open_orders int;
  v_unpaid_invoices int;
  v_pending_transfers int;
  v_tag text := 'deleted-' || left(p_user_id::text, 8);
  v_report jsonb := '{}'::jsonb;
begin
  select * into v_user from public.users where id = p_user_id;

  -- Already closed (a retry after the auth delete failed): nothing to undo.
  if v_user.id is not null and v_user.email like '%@deleted.neesh.invalid' then
    return jsonb_build_object('status', 'already_closed');
  end if;

  if v_user.id is not null and v_user.role = 'admin' then
    raise exception 'admin accounts are closed by hand' using errcode = 'P0001';
  end if;

  select id into v_retailer_id from public.retailers where user_id = p_user_id;
  select id into v_publisher_id from public.publishers where user_id = p_user_id;

  -- Refuse while money or goods are still moving.
  select count(*) into v_open_orders from public.orders o
  where (o.retailer_id = p_user_id
         or o.magazine_id in (select m.id from public.magazines m where m.publisher_id = v_publisher_id))
    and o.status in ('pending', 'paid', 'processing');
  if v_open_orders > 0 then
    raise exception 'open_orders:%', v_open_orders using errcode = 'P0001';
  end if;

  if to_regclass('public.invoices') is not null then
    execute 'select count(*) from public.invoices where retailer_id = $1 and status in (''draft'', ''open'', ''overdue'')'
      into v_unpaid_invoices using p_user_id;
    if v_unpaid_invoices > 0 then
      raise exception 'unpaid_invoices:%', v_unpaid_invoices using errcode = 'P0001';
    end if;
  end if;

  if v_publisher_id is not null then
    select count(*) into v_pending_transfers from public.publisher_transfers
    where publisher_id = v_publisher_id and status = 'pending';
    if v_pending_transfers > 0 then
      raise exception 'pending_payouts:%', v_pending_transfers using errcode = 'P0001';
    end if;
  end if;

  -- Data that is only personal: delete.
  delete from public.user_wishlists where user_id = p_user_id;
  delete from public.stock_notifications where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.notification_preferences where user_id = p_user_id;
  if v_retailer_id is not null then
    delete from public.shipping_addresses where retailer_id = v_retailer_id;
  end if;
  if v_user.email is not null then
    delete from public.retailer_applications where lower(buyer_email) = lower(v_user.email);
    delete from public.publisher_applications where lower(email) = lower(v_user.email);
    delete from public.mailing_list_subscribers where lower(email) = lower(v_user.email);
  end if;

  -- Rows that orders, invoices and payouts hang off: keep, de-identified.
  update public.profiles set
    full_name = null, bio = null, avatar_url = null, phone = null,
    address = null, city = null, state = null, postal_code = null,
    website_url = null
  where user_id = p_user_id;

  if v_retailer_id is not null then
    update public.retailers set
      contact_name = null, contact_email = null, phone = null,
      address = null, postal_code = null, shop_description = null,
      instagram_handle = null, profile_image_url = null, shop_url = null,
      email_verification_token_hash = null
    where id = v_retailer_id;
  end if;

  if v_publisher_id is not null then
    update public.publishers set
      application_data = null, description = null, instagram_handle = null
    where id = v_publisher_id;
    -- Listings come down; the magazines stay for order history.
    update public.magazines set is_active = false where publisher_id = v_publisher_id;
  end if;

  -- Shipping addresses on past orders are the person's address once the
  -- goods have arrived; amounts and dates stay for the tax record.
  update public.orders set shipping_address = null
  where retailer_id = p_user_id and status in ('shipped', 'delivered', 'returned', 'cancelled');

  update public.conversation_participants set display_name = 'Deleted user', avatar_url = null
  where user_id = p_user_id;

  if v_user.id is not null then
    update public.users set
      email = v_tag || '@deleted.neesh.invalid',
      username = v_tag,
      password_hash = 'account_closed'
    where id = p_user_id;
  end if;

  v_report := jsonb_build_object(
    'status', 'closed',
    'retailer', v_retailer_id is not null,
    'publisher', v_publisher_id is not null
  );
  return v_report;
end $$;

revoke all on function public.close_user_account(uuid) from public, anon, authenticated;
grant execute on function public.close_user_account(uuid) to service_role;

-- 3. Verification token age ----------------------------------------------------

alter table public.retailers add column if not exists email_verification_sent_at timestamptz;

create or replace function public.protect_retailer_email_verification()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
begin
  if jwt_role not in ('', 'service_role')
     and (new.email_verified_at is distinct from old.email_verified_at
          or new.email_verification_token_hash is distinct from old.email_verification_token_hash
          or new.email_verification_sent_at is distinct from old.email_verification_sent_at) then
    raise exception 'Email verification fields can only be changed by the server';
  end if;
  return new;
end;
$$;
