create extension if not exists pg_trgm with schema extensions;

create type review_status as enum ('approved', 'pending', 'flagged', 'rejected');
create type catalogue_coverage as enum ('complete', 'partial', 'unknown');
create type collection_state as enum ('own', 'want');
create type variant_kind as enum ('alternate_cover', 'edition', 'supplement');
create type availability_level as enum ('reported', 'confirmed');
create type availability_source as enum ('store', 'publisher', 'neesh_check', 'neesh_order');
create type collection_event_type as enum (
  'own_added', 'own_removed', 'want_added', 'want_removed',
  'follow_added', 'follow_removed', 'complete_on', 'complete_off',
  'alert_requested', 'alert_cancelled', 'alert_sent',
  'stockist_click', 'purchase_click', 'acquired_confirmed',
  'issue_viewed', 'title_viewed');
create type report_reason as enum ('inaccurate', 'duplicate', 'offensive', 'other');

alter table directory_titles
  add column catalogue_coverage catalogue_coverage not null default 'unknown',
  add column coverage_checked_at timestamptz,
  add column review_status review_status not null default 'approved',
  add column created_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text,
  add column merged_into uuid references directory_titles(id),
  add column collect_pilot boolean not null default false;
alter table directory_publishers
  add column review_status review_status not null default 'approved',
  add column created_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text,
  add column merged_into uuid references directory_publishers(id);
create index directory_titles_review_idx on directory_titles (review_status, created_at);
create index directory_titles_name_trgm on directory_titles using gin (name extensions.gin_trgm_ops);
create index directory_publishers_name_trgm on directory_publishers using gin (name extensions.gin_trgm_ops);;
