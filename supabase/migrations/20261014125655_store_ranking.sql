create or replace function directory_store_ranking(p_min int default 3)
returns table (
  store_slug text,
  store_name text,
  city text,
  country text,
  city_slug text,
  title_count int
)
language sql stable security definer set search_path = public as $$
  select s.slug, s.name, s.city, s.country, c.slug,
         count(distinct t.id)::int as title_count
  from directory_stores s
  join directory_stockists k on k.store_id = s.id and k.is_current
  join directory_publishers p on p.id = k.publisher_id and p.removed = false and p.eligible = true
  join directory_titles t on t.publisher_id = p.id
                         and (k.title_id is null or k.title_id = t.id)
                         and t.removed = false and t.status in ('active', 'dormant')
  left join directory_cities c on c.name = s.city and c.country = s.country
  group by s.slug, s.name, s.city, s.country, c.slug
  having count(distinct t.id) >= greatest(p_min, 1)
  order by title_count desc, s.name;
$$;
grant execute on function directory_store_ranking(int) to anon, authenticated;;
