-- Fix the handle_new_user trigger to also create public.users record first
-- before creating the profile (to satisfy foreign key constraint)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- First create the public.users record
  INSERT INTO public.users (id, email, username, role, password_hash, email_verified)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(split_part(NEW.email, '@', 1), 'user'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'retailer'),
    'managed_by_supabase_auth',
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Then create the profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;