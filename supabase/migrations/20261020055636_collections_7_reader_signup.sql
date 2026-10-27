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
  -- Readers (Your collection) never get a public.users or profiles row;
  -- those belong to spaces and publishers.
  if new.raw_user_meta_data->>'role' = 'reader' then
    return new;
  end if;

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
