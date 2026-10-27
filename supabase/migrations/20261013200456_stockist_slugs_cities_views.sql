-- Stockists Phase 1 data layer (Neesh stockists build spec): store slugs,
-- directory_cities, and the three read views the title, store and city pages
-- use. Nothing existing is renamed or dropped. Claim and store-added fields
-- (spec items 4 and 5) land with Phase 2.

create extension if not exists unaccent with schema extensions;

-- "Do You Read Me?!", Berlin -> do-you-read-me-berlin
create function directory_slugify(txt text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(txt, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

-- 1. Store slugs: name + city (country code when the list gave no city),
-- numeric suffix on collisions. Set once; never rewritten on rename.
alter table directory_stores add column slug text;

with base as (
  select id,
         directory_slugify(name || ' ' || coalesce(city, country)) as b,
         row_number() over (
           partition by directory_slugify(name || ' ' || coalesce(city, country))
           order by created_at, id
         ) as n
  from directory_stores
)
update directory_stores s
set slug = case when base.n = 1 then base.b else base.b || '-' || base.n end
from base
where base.id = s.id;

alter table directory_stores alter column slug set not null;
create unique index directory_stores_slug_idx on directory_stores(slug);

-- New stores (quarterly re-collection, reader suggestions) get a slug on insert.
create function directory_stores_set_slug() returns trigger
language plpgsql as $$
declare
  b text := directory_slugify(new.name || ' ' || coalesce(new.city, new.country));
  candidate text := b;
  i int := 1;
begin
  if new.slug is not null then
    return new;
  end if;
  while exists (select 1 from directory_stores where slug = candidate) loop
    i := i + 1;
    candidate := b || '-' || i;
  end loop;
  new.slug := candidate;
  return new;
end $$;

create trigger directory_stores_slug
  before insert on directory_stores
  for each row execute function directory_stores_set_slug();

-- 2. Cities. City names were already normalized at import (NYC, Brooklyn and
-- New York are one row; borough stays on the store). When one name exists in
-- several countries, the country with the most stores gets the plain slug
-- (london) and the rest get a country suffix (london-ca).
create table directory_cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     char(2) not null,
  slug        text not null unique,
  store_count int not null default 0,
  title_count int not null default 0,
  updated_at  timestamptz not null default now(),
  unique (name, country)
);

-- Recomputes counts and adds any new city; existing slugs are kept.
create function refresh_directory_cities() returns void
language sql security definer set search_path = public as $$
  with counts as (
    select s.city as name, s.country,
           count(distinct s.id) as store_count,
           count(distinct t.id) as title_count
    from directory_stores s
    join directory_stockists k on k.store_id = s.id and k.is_current
    join directory_publishers p on p.id = k.publisher_id and p.removed = false and p.eligible = true
    left join directory_titles t on t.publisher_id = p.id and t.removed = false
                                and t.status in ('active', 'dormant')
    where s.city is not null
    group by s.city, s.country
  ), ranked as (
    select c.*,
           row_number() over (partition by directory_slugify(c.name)
                              order by c.store_count desc, c.country) as rn
    from counts c
  )
  insert into directory_cities (name, country, slug, store_count, title_count)
  select name, country,
         case when rn = 1 then directory_slugify(name)
              else directory_slugify(name) || '-' || lower(country) end,
         store_count, title_count
  from ranked
  on conflict (name, country) do update
    set store_count = excluded.store_count,
        title_count = excluded.title_count,
        updated_at  = now();
$$;

select refresh_directory_cities();

alter table directory_cities enable row level security;
create policy directory_cities_public_read on directory_cities for select using (true);

-- 3. Read views. security_invoker makes each view run under the caller's
-- role, so the existing RLS on stores, stockists, publishers and titles
-- applies exactly as it does to direct table reads.
create view v_title_stockists with (security_invoker = true) as
select t.id          as title_id,
       t.slug        as title_slug,
       s.slug        as store_slug,
       s.name        as store_name,
       s.city,
       s.borough,
       s.country,
       c.slug        as city_slug,
       k.source_url,
       k.collected_at
from directory_titles t
join directory_stockists k on k.publisher_id = t.publisher_id and k.is_current
join directory_stores s on s.id = k.store_id
left join directory_cities c on c.name = s.city and c.country = s.country;

create view v_store_titles with (security_invoker = true) as
select s.slug              as store_slug,
       t.id                as title_id,
       t.name              as title_name,
       t.slug              as title_slug,
       t.cover_image_path  as cover,
       t.available_on_neesh
from directory_stores s
join directory_stockists k on k.store_id = s.id and k.is_current
join directory_titles t on t.publisher_id = k.publisher_id
where t.removed = false and t.status in ('active', 'dormant');

create view v_city_stores with (security_invoker = true) as
select c.slug   as city_slug,
       s.slug   as store_slug,
       s.name   as store_name,
       s.borough,
       count(distinct t.id) as title_count
from directory_cities c
join directory_stores s on s.city = c.name and s.country = c.country
join directory_stockists k on k.store_id = s.id and k.is_current
join directory_titles t on t.publisher_id = k.publisher_id
where t.removed = false and t.status in ('active', 'dormant')
group by c.slug, s.slug, s.name, s.borough;

grant select on v_title_stockists, v_store_titles, v_city_stores, directory_cities to anon, authenticated;;
