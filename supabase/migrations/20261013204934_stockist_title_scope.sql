alter table directory_stockists
  add column title_id uuid references directory_titles(id) on delete cascade;

alter table directory_stockists drop constraint directory_stockists_publisher_id_store_id_key;
create unique index directory_stockists_scope_idx
  on directory_stockists(publisher_id, store_id, coalesce(title_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index directory_stockists_title_idx on directory_stockists(title_id) where title_id is not null;

create or replace view v_title_stockists with (security_invoker = true) as
select t.id          as title_id,
       t.slug        as title_slug,
       s.slug        as store_slug,
       s.name        as store_name,
       s.city,
       s.borough,
       s.country,
       c.slug        as city_slug,
       k.source_url,
       k.collected_at,
       case when k.title_id is null then 'publisher' else 'title' end as list_scope
from directory_titles t
join directory_stockists k on k.publisher_id = t.publisher_id and k.is_current
                          and (k.title_id is null or k.title_id = t.id)
join directory_stores s on s.id = k.store_id
left join directory_cities c on c.name = s.city and c.country = s.country;

create or replace view v_store_titles with (security_invoker = true) as
select s.slug              as store_slug,
       t.id                as title_id,
       t.name              as title_name,
       t.slug              as title_slug,
       t.cover_image_path  as cover,
       t.available_on_neesh
from directory_stores s
join directory_stockists k on k.store_id = s.id and k.is_current
join directory_titles t on t.publisher_id = k.publisher_id
                       and (k.title_id is null or k.title_id = t.id)
where t.removed = false and t.status in ('active', 'dormant');

create or replace view v_city_stores with (security_invoker = true) as
select c.slug   as city_slug,
       s.slug   as store_slug,
       s.name   as store_name,
       s.borough,
       count(distinct t.id) as title_count
from directory_cities c
join directory_stores s on s.city = c.name and s.country = c.country
join directory_stockists k on k.store_id = s.id and k.is_current
join directory_titles t on t.publisher_id = k.publisher_id
                       and (k.title_id is null or k.title_id = t.id)
where t.removed = false and t.status in ('active', 'dormant')
group by c.slug, s.slug, s.name, s.borough;;
