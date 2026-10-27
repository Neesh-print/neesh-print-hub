-- Where Index titles are physically sold, from each publisher's published
-- stockist list. Feeds the "See where it's stocked" button on title pages.
-- Stores are shared across publishers so one shop links to every Index
-- title it carries. Lists are per publisher (that is how they are
-- published); a title page reads its publisher's stockists.

create type stockist_list_status as enum ('found','no_list','unreachable');

alter table directory_publishers
  add column stockist_page_url   text,
  add column stockist_status     stockist_list_status,
  add column stockist_note       text,                -- partial, dated, distributor only, etc.
  add column stockist_checked_at date;

create table directory_stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,                  -- English, metro level ("New York", "London"); null when the list gives none
  borough     text,                  -- NYC borough, London area or suburb folded into the metro
  country     char(2) not null,      -- ISO 3166-1 alpha-2
  website     text,
  match_key   text not null,         -- normalized name used to de-duplicate stores within a city
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index directory_stores_match_idx
  on directory_stores(country, coalesce(city, ''), match_key);
create index directory_stores_city_idx on directory_stores(country, city);

create table directory_stockists (
  id            uuid primary key default gen_random_uuid(),
  publisher_id  uuid not null references directory_publishers(id) on delete cascade,
  store_id      uuid not null references directory_stores(id) on delete cascade,
  listed_name   text,                -- the store name as the publisher wrote it
  source_url    text not null,       -- the publisher's stockist page
  collected_at  date not null,
  is_current    boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (publisher_id, store_id)
);
create index directory_stockists_store_idx on directory_stockists(store_id);

create trigger directory_stores_updated_at
  before update on directory_stores
  for each row execute function directory_set_updated_at();

-- RLS: public reads only; writes go through the service role.
alter table directory_stores    enable row level security;
alter table directory_stockists enable row level security;

create policy directory_stores_public_read on directory_stores
  for select using (true);

create policy directory_stockists_public_read on directory_stockists
  for select using (
    is_current
    and exists (
      select 1 from directory_publishers p
      where p.id = directory_stockists.publisher_id
        and p.removed = false
        and p.eligible = true
    )
  );;
