create table public.directory_stockist_suggestions (
  id         uuid primary key default gen_random_uuid(),
  title_id   uuid not null references public.directory_titles(id) on delete cascade,
  shop_name  text not null,
  city       text not null,
  email      text,
  status     text not null default 'new' check (status in ('new', 'added', 'declined')),
  created_at timestamptz not null default now()
);
create index directory_stockist_suggestions_status_idx
  on public.directory_stockist_suggestions(status, created_at);

alter table public.directory_stockist_suggestions enable row level security;;
