create function directory_listed_stores()
returns table (slug text, last_collected date)
language sql stable security definer set search_path = public as $$
  select s.slug, max(k.collected_at)
  from directory_stores s
  join directory_stockists k on k.store_id = s.id and k.is_current
  join directory_publishers p on p.id = k.publisher_id and p.removed = false and p.eligible = true
  join directory_titles t on t.publisher_id = p.id
                         and (k.title_id is null or k.title_id = t.id)
                         and t.removed = false and t.status in ('active', 'dormant')
  group by s.slug
  order by s.slug;
$$;
grant execute on function directory_listed_stores() to anon, authenticated;;
