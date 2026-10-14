-- REVIEW DRAFT ONLY. Run by a trusted database operator after explicit approval.
-- Set nustand.owner_id and nustand.owner_email in the SAME trusted SQL session
-- to the independently verified account. No real identity belongs in this file.
-- Does not change marketplace roles. No callable enrollment function is created.
do $$
declare
  intended_id uuid := nullif(current_setting('nustand.owner_id', true), '')::uuid;
  intended_email text := nullif(current_setting('nustand.owner_email', true), '');
begin
  if intended_id is null or intended_email is null then
    raise exception 'Verified owner ID and email are required';
  end if;
  lock table nustand_private.owner in exclusive mode;
  if not exists (
    select 1 from auth.users a join public.users u on u.id = a.id
    where a.id = intended_id and lower(a.email) = lower(intended_email)
      and a.email_confirmed_at is not null and u.role = 'admin'
  ) then
    raise exception 'Owner must match the verified confirmed admin account';
  end if;
  if exists (select 1 from nustand_private.owner where user_id <> intended_id) then
    raise exception 'A different owner is enrolled; reassignment needs separate review';
  end if;
  insert into nustand_private.owner(user_id) values (intended_id)
    on conflict (user_id) do nothing;
end $$;
