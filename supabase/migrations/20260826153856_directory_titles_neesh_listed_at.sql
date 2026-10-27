-- When the title's platform listing was created. Drives the Featured
-- badge: the three most recently listed Neesh titles are always featured.
alter table public.directory_titles
  add column if not exists neesh_listed_at timestamptz;

update public.directory_titles dt
set neesh_listed_at = m.created_at
from public.magazines m
where dt.neesh_magazine_id = m.id;;
