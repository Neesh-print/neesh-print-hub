-- Suggests a readable, unique username: business name first, then a
-- non-generic email prefix, then the email domain. Collisions get -2, -3.
create or replace function public.suggest_username(p_name text, p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  generic_prefixes text[] := array['hello','hi','hey','info','contact','admin','team','office','mail',
    'support','sales','press','orders','order','shop','store','editor','editors','studio','test',
    'user','general','enquiries','inquiries','help','noreply','no-reply','media','marketing'];
  free_domains text[] := array['gmail','googlemail','yahoo','hotmail','outlook','live','icloud','me',
    'mac','aol','proton','protonmail','pm','gmx','fastmail','zoho','yandex','mail'];
  local_part text := lower(split_part(coalesce(p_email, ''), '@', 1));
  domain_part text := lower(split_part(split_part(coalesce(p_email, ''), '@', 2), '.', 1));
  base text;
  candidate text;
  i int := 1;
begin
  base := public.directory_slugify(p_name);

  if base = '' then
    base := public.directory_slugify(local_part);
    if (base = '' or base = any(generic_prefixes))
       and domain_part <> '' and not (domain_part = any(free_domains)) then
      base := public.directory_slugify(domain_part);
    end if;
  end if;

  base := trim(both '-' from left(coalesce(nullif(base, ''), 'user'), 30));
  if base = '' then base := 'user'; end if;

  candidate := base;
  while exists (select 1 from public.users where username = candidate) loop
    i := i + 1;
    candidate := base || '-' || i;
  end loop;
  return candidate;
end;
$$;

revoke all on function public.suggest_username(text, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  user_role text;
  display_name text;
  base_username text;
  final_username text;
begin
  user_role := new.raw_user_meta_data->>'role';
  user_role := case
    when user_role = 'admin' then 'retailer'
    when user_role in ('publisher', 'retailer') then user_role
    else 'retailer'
  end;

  -- Prefer the business the person applied with, so usernames read like
  -- "bobbety" rather than "hello-7b2c". Any failure here falls back to the
  -- previous email-prefix logic so signups never break.
  begin
    display_name := coalesce(
      nullif(new.raw_user_meta_data->>'business_name', ''),
      nullif(new.raw_user_meta_data->>'shop_name', ''),
      (select coalesce(nullif(pa.business_name, ''), pa.magazine_title)
         from public.publisher_applications pa
        where lower(pa.email) = lower(new.email)
        order by pa.created_at desc limit 1),
      (select ra.shop_name
         from public.retailer_applications ra
        where lower(ra.buyer_email) = lower(new.email)
        order by ra.created_at desc limit 1)
    );
    final_username := public.suggest_username(display_name, new.email);
  exception when others then
    base_username := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
    final_username := base_username;
    while exists (select 1 from public.users where username = final_username) loop
      final_username := base_username || '-' || substr(md5(random()::text), 1, 4);
    end loop;
  end;

  insert into public.users (id, email, username, role, password_hash, email_verified)
  values (
    new.id,
    new.email,
    final_username,
    user_role,
    'managed_by_supabase_auth',
    case when new.email_confirmed_at is not null then true else false end
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;;
