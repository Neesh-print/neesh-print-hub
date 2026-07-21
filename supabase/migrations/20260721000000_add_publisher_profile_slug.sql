-- Publisher public-profile pretty links + weekly reminder plumbing
-- 1. Adds publishers.profile_slug (the stored "pretty link" slug) and
--    publishers.profile_reminder_sent_at (idempotency for the reminder email).
-- 2. Generates a unique, readable slug for every existing publisher.
-- 3. Keeps the slug stable on rename, except when the current slug is a
--    non-pretty id fallback (regenerated once a real company_name exists).

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS profile_slug text,
  ADD COLUMN IF NOT EXISTS profile_reminder_sent_at timestamptz;

COMMENT ON COLUMN public.publishers.profile_slug IS
  'URL slug for the public profile page (neesh.art/p/{profile_slug}). System-managed; unique.';
COMMENT ON COLUMN public.publishers.profile_reminder_sent_at IS
  'When the "your public page exists" reminder email was sent. NULL = not yet sent.';

-- ---------------------------------------------------------------------------
-- Base slug generator — mirrors the JS slugify() in src/lib/slugify.ts,
-- with a fallback for blank/unusable names so the result is never empty.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publisher_base_slug(_name text, _id uuid)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  s := lower(coalesce(_name, ''));
  s := regexp_replace(s, '[^a-z0-9_[:space:]-]', '', 'g'); -- strip non-word chars (keep _, space, -)
  s := regexp_replace(s, '[[:space:]_-]+', '-', 'g');      -- collapse spaces/underscores/hyphens
  s := regexp_replace(s, '^-+|-+$', '', 'g');              -- trim leading/trailing hyphens
  IF s IS NULL OR s = '' THEN
    s := 'publisher-' || substr(_id::text, 1, 8);          -- fallback for nameless publishers
  END IF;
  RETURN s;
END;
$$;

-- ---------------------------------------------------------------------------
-- Uniqueness-aware slug generator — appends -2, -3, ... on collision
-- (this is what disambiguates the two "Family Style" publishers).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publisher_unique_slug(_name text, _id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  n int := 1;
BEGIN
  base := public.publisher_base_slug(_name, _id);
  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.publishers
    WHERE profile_slug = candidate AND id <> _id
  ) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  RETURN candidate;
END;
$$;

-- ---------------------------------------------------------------------------
-- Backfill existing rows. Ordered by created_at so the earliest publisher
-- keeps the clean base slug and later collisions get the -N suffix.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, company_name
    FROM public.publishers
    WHERE profile_slug IS NULL
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    UPDATE public.publishers
      SET profile_slug = public.publisher_unique_slug(r.company_name, r.id)
      WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Constraints: every publisher now has a unique, non-null pretty link.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS publishers_profile_slug_key
  ON public.publishers (profile_slug);

ALTER TABLE public.publishers
  ALTER COLUMN profile_slug SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Trigger: auto-assign on insert; keep stable on rename EXCEPT when the
-- existing slug is a non-pretty id fallback (regenerate it to a readable one).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_publisher_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.profile_slug IS NULL OR NEW.profile_slug = '' THEN
      NEW.profile_slug := public.publisher_unique_slug(NEW.company_name, NEW.id);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.profile_slug IS NULL OR NEW.profile_slug = '' THEN
      NEW.profile_slug := public.publisher_unique_slug(NEW.company_name, NEW.id);
    ELSIF NEW.company_name IS DISTINCT FROM OLD.company_name
          AND OLD.profile_slug ~ '^publisher-[0-9a-f]{8}$' THEN
      -- Current slug is a non-pretty id fallback and the name changed:
      -- regenerate to a readable slug now that a real name may exist.
      NEW.profile_slug := public.publisher_unique_slug(NEW.company_name, NEW.id);
    ELSE
      -- Otherwise the slug is stable: shared links keep working across renames.
      NEW.profile_slug := OLD.profile_slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_publisher_slug ON public.publishers;
CREATE TRIGGER trg_set_publisher_slug
  BEFORE INSERT OR UPDATE ON public.publishers
  FOR EACH ROW EXECUTE FUNCTION public.set_publisher_slug();

-- ---------------------------------------------------------------------------
-- Due-reminder query used by the edge function (service role only).
-- Approved publishers, approved >= 7 days ago, not yet reminded, with a real
-- external email. @neesh.art addresses (internal/staff/import buckets) are
-- excluded on purpose.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.due_profile_reminders()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  company_name text,
  profile_slug text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    u.email,
    COALESCE(NULLIF(pr.full_name, ''), p.company_name, 'there') AS name,
    p.company_name,
    p.profile_slug
  FROM public.publishers p
  JOIN public.users u ON u.id = p.user_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.application_status = 'approved'
    AND p.profile_reminder_sent_at IS NULL
    AND p.reviewed_at IS NOT NULL
    AND p.reviewed_at <= now() - interval '7 days'
    AND u.email IS NOT NULL
    AND u.email <> ''
    AND u.email NOT ILIKE '%@neesh.art';
$$;

REVOKE ALL ON FUNCTION public.due_profile_reminders() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- One-time send opt-out: mark LMG as already-reminded so the first run of the
-- reminder job (which sweeps up all currently-due publishers) skips it.
-- ---------------------------------------------------------------------------
UPDATE public.publishers
  SET profile_reminder_sent_at = now()
  WHERE id = '162c0e71-5206-4150-b712-768179915c52'  -- LMG
    AND profile_reminder_sent_at IS NULL;
