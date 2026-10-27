create table directory_issues (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references directory_titles(id) on delete cascade,
  issue_label text not null,
  issue_number numeric,
  sort_order integer,
  published_on date,
  published_year integer,
  cover_image_path text,
  barcode text,
  isbn text,
  cover_price numeric,
  currency character(3),
  page_count integer,
  notes text,
  source_url text,
  verified_at timestamptz,
  neesh_magazine_id uuid,
  followers_notified_at timestamptz,
  created_from provenance not null default 'admin_created',
  created_by uuid references auth.users(id) on delete set null,
  review_status review_status not null default 'approved',
  reviewed_at timestamptz,
  review_note text,
  merged_into uuid references directory_issues(id),
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index directory_issues_title_label_uniq
  on directory_issues (title_id, lower(issue_label)) where not removed and merged_into is null;
create index directory_issues_title_idx on directory_issues (title_id);
create index directory_issues_review_idx on directory_issues (review_status, created_at);
create index directory_issues_magazine_idx on directory_issues (neesh_magazine_id) where neesh_magazine_id is not null;
create index directory_issues_label_trgm on directory_issues using gin (issue_label extensions.gin_trgm_ops);
create trigger directory_issues_updated_at
  before update on directory_issues
  for each row execute function directory_set_updated_at();

create table directory_issue_variants (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references directory_issues(id) on delete cascade,
  kind variant_kind not null,
  label text not null,
  cover_image_path text,
  barcode text,
  source_url text,
  created_from provenance not null default 'admin_created',
  created_by uuid references auth.users(id) on delete set null,
  review_status review_status not null default 'approved',
  created_at timestamptz not null default now()
);
create index directory_issue_variants_issue_idx on directory_issue_variants (issue_id);

create table directory_issue_availability (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references directory_issues(id) on delete cascade,
  store_id uuid not null references directory_stores(id) on delete cascade,
  level availability_level not null,
  source availability_source not null,
  source_url text,
  source_note text,
  observed_on date not null,
  expires_on date not null,
  alerts_sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index issue_availability_live_idx on directory_issue_availability (issue_id, expires_on);

create function directory_issue_availability_expiry() returns trigger
language plpgsql as $$
begin
  if new.expires_on is null then
    new.expires_on := new.observed_on + case new.level when 'confirmed' then 14 else 60 end;
  end if;
  return new;
end $$;
create trigger directory_issue_availability_expiry
  before insert on directory_issue_availability
  for each row execute function directory_issue_availability_expiry();

create table collectors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_city_id uuid references directory_cities(id),
  is_public boolean not null default false,
  notify_new_issues boolean not null default true,
  newsletter_opt_in boolean not null default false,
  newsletter_consent_at timestamptz,
  first_source text,
  first_anon_id uuid,
  can_add boolean not null default true,
  created_at timestamptz not null default now()
);

create table collection_items (
  user_id uuid not null references collectors(user_id) on delete cascade,
  issue_id uuid not null references directory_issues(id) on delete cascade,
  state collection_state not null,
  variant_id uuid references directory_issue_variants(id) on delete set null,
  condition text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, issue_id)
);
create index collection_items_issue_idx on collection_items (issue_id, state);
create trigger collection_items_updated_at
  before update on collection_items
  for each row execute function directory_set_updated_at();

create table collector_titles (
  user_id uuid not null references collectors(user_id) on delete cascade,
  title_id uuid not null references directory_titles(id) on delete cascade,
  following boolean not null default false,
  completing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);
create index collector_titles_following_idx on collector_titles (title_id) where following;
create trigger collector_titles_updated_at
  before update on collector_titles
  for each row execute function directory_set_updated_at();

create table availability_requests (
  user_id uuid not null references collectors(user_id) on delete cascade,
  issue_id uuid not null references directory_issues(id) on delete cascade,
  city_id uuid references directory_cities(id),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  primary key (user_id, issue_id)
);
create index availability_requests_open_idx on availability_requests (issue_id)
  where fulfilled_at is null and cancelled_at is null;

create table collection_events (
  id bigint generated always as identity primary key,
  user_id uuid references collectors(user_id) on delete set null,
  anon_id uuid,
  event_type collection_event_type not null,
  title_id uuid references directory_titles(id),
  issue_id uuid references directory_issues(id),
  store_id uuid references directory_stores(id),
  surface text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  created_at timestamptz not null default now()
);
create index collection_events_type_idx on collection_events (event_type, created_at);
create index collection_events_issue_idx on collection_events (issue_id, event_type);
create index collection_events_anon_idx on collection_events (anon_id) where anon_id is not null and user_id is null;
create index collection_events_user_idx on collection_events (user_id, event_type, created_at);

create table content_reports (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('title', 'issue', 'variant', 'publisher')),
  target_id uuid not null,
  reason report_reason not null,
  note text,
  reporter_id uuid references collectors(user_id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index content_reports_open_idx on content_reports (target_id) where resolved_at is null;

-- RLS on from the start; policies follow in a later chunk.
alter table directory_issues             enable row level security;
alter table directory_issue_variants     enable row level security;
alter table directory_issue_availability enable row level security;
alter table collectors                   enable row level security;
alter table collection_items             enable row level security;
alter table collector_titles             enable row level security;
alter table availability_requests        enable row level security;
alter table collection_events            enable row level security;
alter table content_reports              enable row level security;

create view collection_not_owned with (security_invoker = true) as
select t.user_id, i.title_id, i.id as issue_id,
       coalesce(ct.completing, false) as completing
from (select distinct c.user_id, di.title_id
      from collection_items c join directory_issues di on di.id = c.issue_id
      where c.state = 'own') t
join directory_issues i on i.title_id = t.title_id
  and not i.removed and i.merged_into is null and i.review_status <> 'rejected'
left join collector_titles ct on ct.user_id = t.user_id and ct.title_id = t.title_id
where not exists (select 1 from collection_items x
  where x.user_id = t.user_id and x.issue_id = i.id and x.state = 'own');;
