-- Link directory titles to the live Neesh platform catalog so profiles can
-- say "you can order this on Neesh right now". neesh_magazine_id points at
-- public.magazines; available_on_neesh is the render flag.
alter table public.directory_titles
  add column if not exists neesh_magazine_id uuid,
  add column if not exists available_on_neesh boolean not null default false;

create index if not exists directory_titles_available_on_neesh_idx
  on public.directory_titles (available_on_neesh) where available_on_neesh;;
