-- Remove overly broad read access to profiles (PII: full_name, phone, address, postal_code, stripe_customer_id)
drop policy if exists "Anyone can view public profiles" on public.profiles;
drop policy if exists "Authenticated can view all profiles" on public.profiles;

-- Admins retain full read access; users keep "Users can view own profile" (already exists)
create policy "Admins can view all profiles"
  on public.profiles
  for select
  to authenticated
  using (is_admin());;
