-- Retailer email verification for the instant-access signup flow.
-- New signups get a session immediately; email_verified_at gates the first
-- order (enforced in the create-checkout edge function). The token is stored
-- hashed so a retailer reading their own row via RLS cannot self-verify.

ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash text;

-- Existing retailers all proved their email already (admin approval flow or
-- the set-password welcome email), so grandfather them in as verified.
UPDATE public.retailers
SET email_verified_at = COALESCE(verified_at, created_at, now())
WHERE email_verified_at IS NULL;

-- Retailers can UPDATE their own row via RLS (profile editing), so block
-- client-side writes to the verification columns. PostgREST requests carry
-- JWT claims; direct connections (migrations, dashboard SQL) do not and are
-- allowed through, as is the service role used by edge functions.
CREATE OR REPLACE FUNCTION public.protect_retailer_email_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
BEGIN
  IF jwt_role NOT IN ('', 'service_role')
     AND (NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at
          OR NEW.email_verification_token_hash IS DISTINCT FROM OLD.email_verification_token_hash) THEN
    RAISE EXCEPTION 'Email verification fields can only be changed by the server';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_retailer_email_verification ON public.retailers;
CREATE TRIGGER protect_retailer_email_verification
  BEFORE UPDATE ON public.retailers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_retailer_email_verification();
