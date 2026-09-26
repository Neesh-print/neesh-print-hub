-- Key that lets admin_ops.marketing() call the marketing-data edge function.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'marketing_proxy_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'marketing_proxy_key',
      'Lets admin_ops.marketing call the marketing-data edge function');
  end if;
end $$;

create or replace function public.verify_marketing_proxy_key(p_key text)
returns boolean language sql security definer set search_path = '' as $$
  select coalesce(length(p_key) >= 32, false)
     and exists (select 1 from vault.decrypted_secrets
                 where name = 'marketing_proxy_key' and decrypted_secret = p_key);
$$;
revoke all on function public.verify_marketing_proxy_key(text) from public, anon, authenticated;
grant execute on function public.verify_marketing_proxy_key(text) to service_role;

-- Google credentials the edge function needs, read from the vault (service role only).
-- Names: ga4_service_account, gads_developer_token, gads_client_id,
-- gads_client_secret, gads_refresh_token, gads_login_customer_id (optional).
create or replace function public.get_marketing_secrets()
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('ga4_service_account','gads_developer_token','gads_client_id',
                 'gads_client_secret','gads_refresh_token','gads_login_customer_id');
$$;
revoke all on function public.get_marketing_secrets() from public, anon, authenticated;
grant execute on function public.get_marketing_secrets() to service_role;

-- Call the edge function. action: ga4_report | ga4_realtime | gads_search | gads_mutate | status
-- The bearer below is the project's public anon key (needed only to pass the gateway).
create or replace function admin_ops.marketing(p_action text, p_payload jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_key text; v_id bigint;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'marketing_proxy_key';
  select net.http_post(
    url := 'https://smfzrubkyxejzkblrrjr.supabase.co/functions/v1/marketing-data',
    body := jsonb_build_object('action', p_action, 'payload', p_payload),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZnpydWJreXhlanprYmxycmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3Nzc1MTcsImV4cCI6MjA2ODM1MzUxN30.1DF1Gtz3rIH0ifyeu0IUSKZmIy4LFnA1ddEtYjLSO0w',
      'x-marketing-key', v_key),
    timeout_milliseconds := 60000
  ) into v_id;
  return v_id;
end $$;
revoke all on function admin_ops.marketing(text, jsonb) from public, anon, authenticated;

-- Read any pg_net response (works for approvals too).
create or replace function admin_ops.http_result(p_request_id bigint)
returns table (status_code int, content jsonb, error_msg text, timed_out boolean)
language sql security definer set search_path = '' as $$
  select r.status_code,
         case when r.content ~ '^\s*[\[{]' then r.content::jsonb else to_jsonb(r.content) end,
         r.error_msg, r.timed_out
  from net._http_response r where r.id = p_request_id;
$$;
revoke all on function admin_ops.http_result(bigint) from public, anon, authenticated;
