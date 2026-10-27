-- Demo listings: visible only to demo/test accounts (+ owner/admin), never to
-- the public catalogue or explore.

alter table public.magazines add column if not exists is_demo boolean not null default false;
alter table public.users     add column if not exists is_demo boolean not null default false;

comment on column public.magazines.is_demo is
  'Demo/example listing: visible only to users flagged is_demo (test accounts), plus owner/admin. Never shown on public explore or to real retailers.';
comment on column public.users.is_demo is
  'Test/demo account: may see is_demo magazines in the catalogue.';

-- SECURITY DEFINER helper so the policy can check the flag without tripping RLS on users.
create or replace function public.current_user_is_demo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and is_demo = true);
$$;

-- Public/authenticated read: active AND non-demo (replaces the old active-only policy).
drop policy if exists "Anyone can view active magazines" on public.magazines;
create policy "Anyone can view active non-demo magazines"
on public.magazines for select
using (is_active = true and is_demo = false);

-- Demo accounts may additionally see active demo magazines.
drop policy if exists "Demo accounts can view demo magazines" on public.magazines;
create policy "Demo accounts can view demo magazines"
on public.magazines for select
using (is_active = true and is_demo = true and public.current_user_is_demo());;
