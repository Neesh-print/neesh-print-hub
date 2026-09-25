-- Already applied to production on 2026-09-25 (version 20260925180136).
-- Lets an admin approve an application from SQL through the same
-- approve-application edge function the dashboard uses (account, listing and
-- welcome email). The approval key is generated inside the vault and never
-- leaves the database; the edge function checks it via
-- verify_admin_approval_key. Usage:
--   select admin_ops.approve_application('<application id>', 'publisher');
--   select * from admin_ops.approval_result(<returned request id>);

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'admin_approval_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'admin_approval_key',
      'Lets admin_ops.approve_application call the approve-application edge function'
    );
  end if;
end $$;

create or replace function public.verify_admin_approval_key(p_key text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(length(p_key) >= 32, false)
     and exists (
       select 1 from vault.decrypted_secrets
       where name = 'admin_approval_key' and decrypted_secret = p_key
     );
$$;
revoke all on function public.verify_admin_approval_key(text) from public, anon, authenticated;
grant execute on function public.verify_admin_approval_key(text) to service_role;

create schema if not exists admin_ops;
revoke all on schema admin_ops from public, anon, authenticated;

create or replace function admin_ops.approve_application(
  p_application_id uuid,
  p_type text,
  p_reviewer_id uuid default '03c780fd-efc8-4939-b34d-ab3cf80d7249'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_key text;
  v_request_id bigint;
begin
  if p_type not in ('publisher', 'retailer') then
    raise exception 'type must be publisher or retailer';
  end if;

  if p_type = 'publisher' then
    select status into v_status from public.publisher_applications where id = p_application_id;
  else
    select status into v_status from public.retailer_applications where id = p_application_id;
  end if;

  if v_status is null then
    raise exception 'No % application with id %', p_type, p_application_id;
  end if;
  if v_status <> 'submitted' then
    raise exception 'Application % is already %', p_application_id, v_status;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'admin_approval_key';

  -- The anon key below is the project's public key; the gateway needs a JWT
  -- and the approval key does the real authorization.
  select net.http_post(
    url := 'https://smfzrubkyxejzkblrrjr.supabase.co/functions/v1/approve-application',
    body := jsonb_build_object('applicationId', p_application_id, 'type', p_type),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZnpydWJreXhlanprYmxycmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3Nzc1MTcsImV4cCI6MjA2ODM1MzUxN30.1DF1Gtz3rIH0ifyeu0IUSKZmIy4LFnA1ddEtYjLSO0w',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZnpydWJreXhlanprYmxycmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3Nzc1MTcsImV4cCI6MjA2ODM1MzUxN30.1DF1Gtz3rIH0ifyeu0IUSKZmIy4LFnA1ddEtYjLSO0w',
      'x-admin-approval-key', v_key,
      'x-admin-reviewer-id', p_reviewer_id::text
    ),
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
end;
$$;
revoke all on function admin_ops.approve_application(uuid, text, uuid) from public, anon, authenticated;

create or replace function admin_ops.approval_result(p_request_id bigint)
returns table (status_code int, content text, error_msg text, timed_out boolean)
language sql
security definer
set search_path = ''
as $$
  select r.status_code, r.content::text, r.error_msg, r.timed_out
  from net._http_response r where r.id = p_request_id;
$$;
revoke all on function admin_ops.approval_result(bigint) from public, anon, authenticated;
