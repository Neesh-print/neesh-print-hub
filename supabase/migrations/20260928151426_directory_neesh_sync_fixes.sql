
create or replace function public.directory_sync_slugify(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(lower(replace(coalesce(p,''), '&', ' and ')), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
$$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('public.directory_sync_magazine(uuid)'::regprocedure);
  src := replace(src,
    'select * into app from public.publisher_applications a where a.user_id = p.user_id order by a.created_at desc limit 1;
  select u.email into v_email from public.users u where u.id = p.user_id;
  v_email := coalesce(v_email, app.email);',
    'select u.email into v_email from public.users u where u.id = p.user_id;
  select * into app from public.publisher_applications a
    where a.user_id = p.user_id or (v_email is not null and lower(a.email) = lower(v_email))
    order by (a.status = ''approved'') desc, a.created_at desc limit 1;
  v_email := coalesce(v_email, app.email);');
  src := replace(src, 'v_city := nullif(btrim(app.shipping_city), '''');', 'v_city := null; -- shipping city is a fulfillment address, not the publisher''s home');
  if src !~ 'lower\(a.email\)' or src !~ 'fulfillment address' then raise exception 'patch did not apply'; end if;
  execute src;
end $do$;
;
