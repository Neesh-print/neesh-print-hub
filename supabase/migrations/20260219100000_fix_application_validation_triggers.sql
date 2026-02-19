-- =============================================================
-- Fix application validation triggers
-- The triggers were running email/length validation on every UPDATE,
-- even when only status/reviewed_by fields were changing.
-- This caused 400 errors when admins tried to decline/hold applications
-- if existing data didn't match the regex (e.g., pre-trigger data).
-- Fix: Only validate fields on INSERT or when those fields change.
-- =============================================================

-- Fix retailer application validation
CREATE OR REPLACE FUNCTION public.validate_retailer_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- On UPDATE, only validate fields that are actually changing
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.buyer_email IS DISTINCT FROM OLD.buyer_email) THEN
    IF NEW.buyer_email IS NOT NULL AND NEW.buyer_email !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format for buyer_email';
    END IF;
    IF length(NEW.buyer_email) > 255 THEN
      RAISE EXCEPTION 'buyer_email exceeds maximum length of 255 characters';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.buyer_name IS DISTINCT FROM OLD.buyer_name) THEN
    IF length(NEW.buyer_name) > 200 THEN
      RAISE EXCEPTION 'buyer_name exceeds maximum length of 200 characters';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.shop_name IS DISTINCT FROM OLD.shop_name) THEN
    IF length(NEW.shop_name) > 200 THEN
      RAISE EXCEPTION 'shop_name exceeds maximum length of 200 characters';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix publisher application validation
CREATE OR REPLACE FUNCTION public.validate_publisher_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email) THEN
    IF NEW.email IS NOT NULL AND NEW.email !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format';
    END IF;
    IF length(NEW.email) > 255 THEN
      RAISE EXCEPTION 'email exceeds maximum length of 255 characters';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.first_name IS DISTINCT FROM OLD.first_name) THEN
    IF length(NEW.first_name) > 100 THEN
      RAISE EXCEPTION 'first_name exceeds maximum length of 100 characters';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.last_name IS DISTINCT FROM OLD.last_name) THEN
    IF length(NEW.last_name) > 100 THEN
      RAISE EXCEPTION 'last_name exceeds maximum length of 100 characters';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.magazine_title IS DISTINCT FROM OLD.magazine_title) THEN
    IF length(NEW.magazine_title) > 200 THEN
      RAISE EXCEPTION 'magazine_title exceeds maximum length of 200 characters';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.business_name IS DISTINCT FROM OLD.business_name) THEN
    IF length(NEW.business_name) > 200 THEN
      RAISE EXCEPTION 'business_name exceeds maximum length of 200 characters';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
