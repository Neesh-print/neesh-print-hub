select refresh_directory_cities();

create function directory_city_stores(p_slug text)
returns table (store_slug text, store_name text, borough text, title_count int)
language sql stable security definer set search_path = public as $$
  select s.slug, s.name, s.borough, count(distinct t.id)::int
  from directory_cities c
  join directory_stores s on s.city = c.name and s.country = c.country
  join directory_stockists k on k.store_id = s.id and k.is_current
  join directory_publishers p on p.id = k.publisher_id and p.removed = false and p.eligible = true
  join directory_titles t on t.publisher_id = p.id
                         and (k.title_id is null or k.title_id = t.id)
                         and t.removed = false and t.status in ('active', 'dormant')
  where c.slug = p_slug
  group by s.slug, s.name, s.borough
  order by count(distinct t.id) desc, s.name;
$$;
grant execute on function directory_city_stores(text) to anon, authenticated;

create function directory_city_top_titles(p_slug text, p_limit int default 10)
returns table (
  kind text,
  title_name text,
  title_slug text,
  cover text,
  available_on_neesh boolean,
  publisher_name text,
  publisher_slug text,
  titles jsonb,
  shops int
)
language sql stable security definer set search_path = public as $$
  with c as (
    select name, country from directory_cities where slug = p_slug
  ), live as (
    select t.* from directory_titles t
    where t.removed = false and t.status in ('active', 'dormant')
  ), pub_n as (
    select publisher_id, count(*) as n from live group by publisher_id
  ), links as (
    select k.store_id, k.publisher_id, k.title_id
    from directory_stockists k
    join directory_stores s on s.id = k.store_id
    join c on s.city = c.name and s.country = c.country
    join directory_publishers p on p.id = k.publisher_id and p.removed = false and p.eligible = true
    where k.is_current
  ), items as (
    select l.store_id, t.id as title_id, null::uuid as publisher_id
    from links l
    join pub_n pn on pn.publisher_id = l.publisher_id
    join live t on t.publisher_id = l.publisher_id and (l.title_id is null or l.title_id = t.id)
    where l.title_id is not null or pn.n = 1
    union
    select l.store_id, null, l.publisher_id
    from links l
    join pub_n pn on pn.publisher_id = l.publisher_id
    where l.title_id is null and pn.n > 1
  ), ranked as (
    select title_id, publisher_id, count(distinct store_id)::int as shops
    from items group by title_id, publisher_id
    order by shops desc
    limit greatest(1, least(p_limit, 50))
  )
  select case when r.title_id is not null then 'title' else 'publisher' end,
         t.name, t.slug, t.cover_image_path, coalesce(t.available_on_neesh, false),
         p.name, p.slug,
         case when r.publisher_id is null then null else (
           select jsonb_agg(jsonb_build_object('name', lt.name, 'slug', lt.slug) order by lt.name)
           from live lt where lt.publisher_id = r.publisher_id
         ) end,
         r.shops
  from ranked r
  left join live t on t.id = r.title_id
  join directory_publishers p on p.id = coalesce(t.publisher_id, r.publisher_id)
  order by r.shops desc, coalesce(t.name, p.name);
$$;
grant execute on function directory_city_top_titles(text, int) to anon, authenticated;;
