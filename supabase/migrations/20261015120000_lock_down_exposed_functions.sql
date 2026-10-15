-- Lock down database functions that anyone on the internet could call through
-- the public API. Each one below is only used by server-side edge functions
-- (service role) or not used at all. Functions intentionally public (Index
-- directory pages, publisher application forms, Odditt) and helpers used by
-- row-level security policies (is_admin, is_conversation_participant,
-- publisher_has_active_magazines, current_user_is_demo) are left unchanged.

-- Server-only: called from edge functions with the service role key.
--   decrease_inventory           stripe-webhook, create-net-order (anyone could zero stock)
--   retailer_outstanding_balance create-net-order (anyone could read any retailer's balance)
--   due_profile_reminders        send-profile-reminders (exposed publisher names and emails)
revoke execute on function public.decrease_inventory(uuid, integer) from public, anon, authenticated;
revoke execute on function public.retailer_outstanding_balance(uuid) from public, anon, authenticated;
revoke execute on function public.due_profile_reminders() from public, anon, authenticated;
grant execute on function public.decrease_inventory(uuid, integer) to service_role;
grant execute on function public.retailer_outstanding_balance(uuid) to service_role;
grant execute on function public.due_profile_reminders() to service_role;

-- Unused by any app, site or edge function, and each leaks data by user id.
revoke execute on function public.get_user_conversation_ids(uuid) from public, anon, authenticated;
revoke execute on function public.get_publisher_status(uuid) from public, anon, authenticated;
revoke execute on function public.calculate_application_score(uuid) from public, anon, authenticated;
grant execute on function public.get_user_conversation_ids(uuid) to service_role;
grant execute on function public.get_publisher_status(uuid) to service_role;
grant execute on function public.calculate_application_score(uuid) to service_role;

-- Rebuilds the Index city table; run by migrations, never by visitors.
revoke execute on function public.refresh_directory_cities() from public, anon, authenticated;
grant execute on function public.refresh_directory_cities() to service_role;

-- Messaging lookup used by signed-in users only; no anonymous access.
revoke execute on function public.find_conversation(uuid, character varying, uuid, character varying) from public, anon;
grant execute on function public.find_conversation(uuid, character varying, uuid, character varying) to authenticated, service_role;
revoke execute on function public.create_conversation(uuid, character varying, character varying, character varying) from public, anon;
grant execute on function public.create_conversation(uuid, character varying, character varying, character varying) to authenticated, service_role;

-- Trigger functions: Postgres fires triggers without checking EXECUTE, so
-- nobody needs to call these directly through the API.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
