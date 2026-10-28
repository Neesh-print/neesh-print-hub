-- Drop the four single-zone flat rate columns.
--
-- 20261027234505_flat_rate_regions moved flat rates into publishers.flat_rates
-- (one rate per region) and kept these columns for one release so it could be
-- rolled back. No app code or database function reads them any more, and every
-- publisher that had a value here has a matching flat_rates entry.
--
-- Run only once per-region flat rates have been live long enough that a
-- rollback is off the table. Their CHECK constraints drop with the columns.

-- Safety net: refuse to drop if any publisher still has an old rate that never
-- made it into flat_rates.
DO $$
DECLARE
  unmigrated INTEGER;
BEGIN
  SELECT count(*) INTO unmigrated
  FROM public.publishers
  WHERE (domestic_first_copy_usd IS NOT NULL OR intl_first_copy_usd IS NOT NULL)
    AND (flat_rates IS NULL OR flat_rates = '{}'::jsonb);
  IF unmigrated > 0 THEN
    RAISE EXCEPTION 'drop_old_flat_rate_columns: % publisher(s) have old flat rates not copied into flat_rates', unmigrated;
  END IF;
END $$;

ALTER TABLE public.publishers
  DROP COLUMN IF EXISTS domestic_first_copy_usd,
  DROP COLUMN IF EXISTS domestic_additional_copy_usd,
  DROP COLUMN IF EXISTS intl_first_copy_usd,
  DROP COLUMN IF EXISTS intl_additional_copy_usd;
