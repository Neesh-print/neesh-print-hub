-- Title suggestions from spaces and readers (the non-publisher branch of
-- the Add a title flow). Written only by the service role from the API
-- route; publishers never land here, they go through the signup flow.
create table if not exists public.directory_suggestions (
  id uuid primary key default gen_random_uuid(),
  title_name text not null,
  publisher_website text,
  email text not null,
  role text not null check (role in ('space', 'reader')),
  status text not null default 'new' check (status in ('new', 'added', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.directory_suggestions enable row level security;
-- No policies: anon and authenticated get nothing; the service role bypasses.;
