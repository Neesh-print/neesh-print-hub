-- Fix the handle_new_user trigger to prevent admin self-assignment
-- This is the CRITICAL security fix - blocks privilege escalation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_role text;
BEGIN
  -- Get the role from user metadata
  user_role := NEW.raw_user_meta_data->>'role';
  
  -- Block admin self-assignment - only allow publisher or retailer
  -- Admin roles must be assigned through a separate secure process
  user_role := CASE
    WHEN user_role = 'admin' THEN 'retailer'  -- Deny admin self-assignment
    WHEN user_role IN ('publisher', 'retailer') THEN user_role
    ELSE 'retailer'  -- Default to retailer for any other value
  END;
  
  -- First create the public.users record with validated role
  INSERT INTO public.users (id, email, username, role, password_hash, email_verified)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(split_part(NEW.email, '@', 1), 'user'),
    user_role,  -- Use the validated role
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

-- Add database constraints to publisher_applications for input validation
-- These columns are not used in policies so we can safely alter them
ALTER TABLE publisher_applications
ALTER COLUMN first_name TYPE VARCHAR(100),
ALTER COLUMN last_name TYPE VARCHAR(100),
ALTER COLUMN magazine_title TYPE VARCHAR(200),
ALTER COLUMN business_name TYPE VARCHAR(200);

-- Add CHECK constraints for email validation on publisher_applications
ALTER TABLE publisher_applications
DROP CONSTRAINT IF EXISTS check_email_format,
ADD CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add database constraints to retailer_applications for input validation
-- Only alter columns not used in RLS policies
ALTER TABLE retailer_applications
ALTER COLUMN buyer_name TYPE VARCHAR(200),
ALTER COLUMN shop_name TYPE VARCHAR(200),
ALTER COLUMN phone TYPE VARCHAR(50);

-- Add a validation function for retailer applications that validates email format
-- This can be used in a trigger instead of altering the column type
CREATE OR REPLACE FUNCTION public.validate_retailer_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Validate email format
  IF NEW.buyer_email IS NOT NULL AND NEW.buyer_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format for buyer_email';
  END IF;
  
  -- Validate length limits
  IF length(NEW.buyer_email) > 255 THEN
    RAISE EXCEPTION 'buyer_email exceeds maximum length of 255 characters';
  END IF;
  
  IF length(NEW.buyer_name) > 200 THEN
    RAISE EXCEPTION 'buyer_name exceeds maximum length of 200 characters';
  END IF;
  
  IF length(NEW.shop_name) > 200 THEN
    RAISE EXCEPTION 'shop_name exceeds maximum length of 200 characters';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for retailer application validation
DROP TRIGGER IF EXISTS validate_retailer_application_trigger ON retailer_applications;
CREATE TRIGGER validate_retailer_application_trigger
BEFORE INSERT OR UPDATE ON retailer_applications
FOR EACH ROW
EXECUTE FUNCTION public.validate_retailer_application();

-- Create similar validation function for publisher applications
CREATE OR REPLACE FUNCTION public.validate_publisher_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Validate email format (redundant with CHECK but provides better error message)
  IF NEW.email IS NOT NULL AND NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Validate length limits
  IF length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'email exceeds maximum length of 255 characters';
  END IF;
  
  IF length(NEW.first_name) > 100 THEN
    RAISE EXCEPTION 'first_name exceeds maximum length of 100 characters';
  END IF;
  
  IF length(NEW.last_name) > 100 THEN
    RAISE EXCEPTION 'last_name exceeds maximum length of 100 characters';
  END IF;
  
  IF length(NEW.magazine_title) > 200 THEN
    RAISE EXCEPTION 'magazine_title exceeds maximum length of 200 characters';
  END IF;
  
  IF length(NEW.business_name) > 200 THEN
    RAISE EXCEPTION 'business_name exceeds maximum length of 200 characters';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for publisher application validation
DROP TRIGGER IF EXISTS validate_publisher_application_trigger ON publisher_applications;
CREATE TRIGGER validate_publisher_application_trigger
BEFORE INSERT OR UPDATE ON publisher_applications
FOR EACH ROW
EXECUTE FUNCTION public.validate_publisher_application();