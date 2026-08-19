-- 1. Drop the Make.com webhook. Make is no longer used, and this trigger fired
--    on INSERT — i.e. the moment someone started the publisher wizard, not when
--    they finished — so it was posting blank applications to a dead endpoint.
DROP TRIGGER IF EXISTS "Publisher Table" ON public.publisher_applications;

-- 2. Record retailer terms acceptance in a real column.
--    signup-retailer was writing acceptedTermsAt into the additional_notes JSON
--    blob, which is untyped text and unqueryable. Promote it to a column on the
--    application (the signup-time record) and on the retailer (current account
--    state, which is what the admin screens read).
--    Note: retailers.terms_* columns already exist for Net payment terms and are
--    unrelated — hence the distinct accepted_terms_at name.
ALTER TABLE public.retailer_applications
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz;

ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz;

-- Backfill from the JSON blob for anyone who already accepted. Parsed per row
-- with an exception guard so a malformed or non-JSON note can't fail the whole
-- migration (older rows contain free-text notes).
DO $$
DECLARE
  r record;
  v_ts timestamptz;
BEGIN
  FOR r IN
    SELECT id, additional_notes
    FROM public.retailer_applications
    WHERE accepted_terms_at IS NULL
      AND additional_notes IS NOT NULL
      AND left(btrim(additional_notes), 1) = '{'
  LOOP
    BEGIN
      v_ts := (r.additional_notes::jsonb ->> 'acceptedTermsAt')::timestamptz;
    EXCEPTION WHEN others THEN
      v_ts := NULL;
    END;

    IF v_ts IS NOT NULL THEN
      UPDATE public.retailer_applications SET accepted_terms_at = v_ts WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- Mirror onto the retailer account, matching the application by email.
UPDATE public.retailers r
SET accepted_terms_at = ra.accepted_terms_at
FROM public.users u, public.retailer_applications ra
WHERE r.user_id = u.id
  AND lower(ra.buyer_email) = lower(u.email)
  AND ra.accepted_terms_at IS NOT NULL
  AND r.accepted_terms_at IS NULL;
