create or replace function refresh_directory_cities() returns void
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
                                and (k.title_id is null or k.title_id = t.id)
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
$$;;
