-- Neesh Publisher Directory v1 (spec v1 locked).
-- Tables carry a directory_ prefix because the shared Neesh Supabase project
-- already contains platform tables named publishers and magazines. Everything
-- else follows the locked spec schema exactly.

create type frequency_type as enum
  ('weekly','monthly','bimonthly','quarterly','triannual','biannual','annual','irregular','evergreen');
create type title_status as enum ('active','dormant','ceased');
create type provenance as enum ('imported','publisher_created','admin_created');
create type claim_status as enum ('pending','approved','rejected');
create type signal_type as enum
  ('view','stock_request','want_near','outbound_click','claim_click');

create table directory_publishers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  website       text,
  contact_email text,
  country       char(2),
  city          text,
  eligible      boolean not null default true,
  eligibility_note text,
  claimed       boolean not null default false,
  claimed_at    timestamptz,
  claimed_email text,
  claim_method  text,
  removed       boolean not null default false,
  created_from  provenance not null default 'imported',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table directory_titles (
  id               uuid primary key default gen_random_uuid(),
  publisher_id     uuid not null references directory_publishers(id),
  name             text not null,
  slug             text not null unique,
  description      text,
  cover_image_path text,
  frequency        frequency_type,
  cover_price      numeric(8,2),
  currency         char(3),
  trim_size        text,
  page_count       int,
  country          char(2),
  city             text,
  status           title_status not null default 'active',
  last_issue_date  date,
  verified_at      timestamptz,
  removed          boolean not null default false,
  created_from     provenance not null default 'imported',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index directory_titles_publisher_idx on directory_titles(publisher_id);
create index directory_titles_live_idx on directory_titles(status) where removed = false;
create index directory_titles_staleness_idx on directory_titles(last_issue_date, verified_at);

create table directory_tags (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  name     text not null,
  category text,
  intro_md text
);

create table directory_title_tags (
  title_id uuid not null references directory_titles(id) on delete cascade,
  tag_id   uuid not null references directory_tags(id) on delete cascade,
  primary key (title_id, tag_id)
);
create index directory_title_tags_tag_idx on directory_title_tags(tag_id);

create table directory_demand_signals (
  id          bigint generated always as identity primary key,
  title_id    uuid not null references directory_titles(id) on delete cascade,
  signal_type signal_type not null,
  payload     jsonb,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index directory_signals_digest_idx
  on directory_demand_signals(title_id, signal_type, created_at);

create table directory_claims (
  id           uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references directory_publishers(id),
  email        text not null,
  name         text,
  message      text,
  status       claim_status not null default 'pending',
  admin_notes  text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create function directory_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger directory_publishers_updated_at
  before update on directory_publishers
  for each row execute function directory_set_updated_at();
create trigger directory_titles_updated_at
  before update on directory_titles
  for each row execute function directory_set_updated_at();

alter table directory_publishers     enable row level security;
alter table directory_titles         enable row level security;
alter table directory_tags           enable row level security;
alter table directory_title_tags     enable row level security;
alter table directory_demand_signals enable row level security;
alter table directory_claims         enable row level security;

create policy directory_publishers_public_read on directory_publishers
  for select using (removed = false and eligible = true);

create policy directory_titles_public_read on directory_titles
  for select using (
    removed = false
    and status in ('active','dormant')
    and exists (
      select 1 from directory_publishers p
      where p.id = directory_titles.publisher_id
        and p.removed = false
        and p.eligible = true
    )
  );

create policy directory_tags_public_read on directory_tags
  for select using (true);

create policy directory_title_tags_public_read on directory_title_tags
  for select using (
    exists (
      select 1
      from directory_titles t
      join directory_publishers p on p.id = t.publisher_id
      where t.id = directory_title_tags.title_id
        and t.removed = false
        and t.status in ('active','dormant')
        and p.removed = false
        and p.eligible = true
    )
  );

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

insert into directory_tags (slug, name, category) values
  ('literature',    'Literature',    'Culture & Ideas'),
  ('philosophy',    'Philosophy',    'Culture & Ideas'),
  ('politics',      'Politics',      'Culture & Ideas'),
  ('history',       'History',       'Culture & Ideas'),
  ('science',       'Science',       'Culture & Ideas'),
  ('queer-culture', 'Queer Culture', 'Culture & Ideas'),
  ('photography',   'Photography',   'Art & Design'),
  ('art',           'Art',           'Art & Design'),
  ('illustration',  'Illustration',  'Art & Design'),
  ('graphic-design','Graphic Design','Art & Design'),
  ('architecture',  'Architecture',  'Art & Design'),
  ('fashion',       'Fashion',       'Living'),
  ('interiors',     'Interiors',     'Living'),
  ('travel',        'Travel',        'Living'),
  ('craft',         'Craft',         'Living'),
  ('gardening',     'Gardening',     'Living'),
  ('kids',          'Kids',          'Living'),
  ('nature',        'Nature',        'Living'),
  ('food',          'Food',          'Food & Drink'),
  ('coffee',        'Coffee',        'Food & Drink'),
  ('wine',          'Wine',          'Food & Drink'),
  ('music',         'Music',         'Music & Screen'),
  ('film',          'Film',          'Music & Screen'),
  ('football',      'Football',      'Sport & Outdoors'),
  ('cycling',       'Cycling',       'Sport & Outdoors'),
  ('climbing',      'Climbing',      'Sport & Outdoors'),
  ('surfing',       'Surfing',       'Sport & Outdoors'),
  ('skateboarding', 'Skateboarding', 'Sport & Outdoors'),
  ('outdoors',      'Outdoors',      'Sport & Outdoors'),
  ('board-games',   'Board Games',   'Games & Play')
on conflict (slug) do nothing;;
