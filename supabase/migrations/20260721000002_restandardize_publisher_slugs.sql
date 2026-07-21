-- Re-standardize existing publisher slugs to the rules defined by
-- publisher_base_slug in 20260721000000 (drop parentheticals, keep the first
-- segment before a separator, collapse repeated adjacent words, strip trailing
-- filler words like llc/magazine/publishing).
--
-- Why this exists: the original migration was applied to some environments
-- before those rules were finalized, leaving slugs like
-- "different-leaf-different-leaf-llc". This migration recomputes every slug so
-- all environments converge on the standardized format. On a fresh database
-- (where 20260721000000 already produced standardized slugs) it is a no-op —
-- it recomputes to the same values.
--
-- Note: the Supabase CLI wraps each migration in a transaction. If you run this
-- by hand in the SQL editor, wrap it in BEGIN; ... COMMIT; yourself so a failure
-- cannot leave profile_slug nullable.

-- Disable the stability trigger and clear slugs so the dedupe starts clean,
-- then regenerate in created_at order (earliest keeps the base slug).
ALTER TABLE public.publishers DISABLE TRIGGER trg_set_publisher_slug;
ALTER TABLE public.publishers ALTER COLUMN profile_slug DROP NOT NULL;
UPDATE public.publishers SET profile_slug = NULL;

-- Manual overrides for names the general rules cannot infer (taglines with no
-- separator). Applied first so the generic loop skips these rows.
UPDATE public.publishers SET profile_slug = 'pitch-stories'
  WHERE id = 'c4a02c34-311b-42df-960c-bc68a1f96223';  -- Pitch Stories Of Modern Sport

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, company_name FROM public.publishers
           WHERE profile_slug IS NULL
           ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    UPDATE public.publishers
      SET profile_slug = public.publisher_unique_slug(r.company_name, r.id)
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.publishers ALTER COLUMN profile_slug SET NOT NULL;
ALTER TABLE public.publishers ENABLE TRIGGER trg_set_publisher_slug;
