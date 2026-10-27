-- Per-region flat shipping rates.
--
-- Publishers on flat rates get one rate per destination region instead of one
-- domestic and one international rate. Regions: domestic (same country, or EU
-- to EU), us, ca, uk, eu, row (rest of world). A missing region is not shipped
-- to. intl_min_copies keeps working off domestic vs international.
--
-- The four *_copy_usd columns stay for one release so this can be rolled back,
-- and are dropped in a follow-up once production quotes match.

-- 1) Validation -----------------------------------------------------------------
-- Shape: { "<region>": { "first": 8.00, "additional": 3.00 }, ... }
-- first is required per region, additional is optional (null or missing = 0).
-- Both 0 to 100 USD, matching the old column checks.
CREATE OR REPLACE FUNCTION public.valid_flat_rates(rates JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_typeof(rates) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(rates) AS r(region, rate)
      WHERE r.region NOT IN ('domestic', 'us', 'ca', 'uk', 'eu', 'row')
        OR CASE
          WHEN jsonb_typeof(r.rate) <> 'object' THEN TRUE
          ELSE
            EXISTS (SELECT 1 FROM jsonb_object_keys(r.rate) AS k WHERE k NOT IN ('first', 'additional'))
            OR CASE jsonb_typeof(r.rate -> 'first')
              WHEN 'number' THEN (r.rate ->> 'first')::numeric NOT BETWEEN 0 AND 100
              ELSE TRUE
            END
            OR CASE COALESCE(jsonb_typeof(r.rate -> 'additional'), 'null')
              WHEN 'number' THEN (r.rate ->> 'additional')::numeric NOT BETWEEN 0 AND 100
              WHEN 'null' THEN FALSE
              ELSE TRUE
            END
        END
    )
$$;

-- 2) Column -----------------------------------------------------------------------
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS flat_rates JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.publishers
  DROP CONSTRAINT IF EXISTS publishers_flat_rates_valid;
ALTER TABLE public.publishers
  ADD CONSTRAINT publishers_flat_rates_valid CHECK (public.valid_flat_rates(flat_rates));

COMMENT ON COLUMN public.publishers.flat_rates IS
  'Flat shipping by region when shipping_rate_mode = flat: {"<domestic|us|ca|uk|eu|row>": {"first": n, "additional": n}}. A missing region is not shipped to.';

COMMENT ON COLUMN public.publishers.shipping_rate_mode IS
  'live = Shippo rates from the ships-from address (default). flat = publishers.flat_rates by region.';

-- 3) Backfill ---------------------------------------------------------------------
-- domestic from domestic_*, and intl_* into every other region. The region of
-- the publisher's own country is also filled: it never resolves (that country
-- is always domestic), and filling it keeps quotes identical for publishers
-- whose origin is unknown, where every destination was international.
-- Only fills publishers that have not saved region rates yet, so re-running is safe.
UPDATE public.publishers p
SET flat_rates = (
  SELECT COALESCE(jsonb_object_agg(region, rate), '{}'::jsonb)
  FROM (
    SELECT 'domestic' AS region,
      jsonb_build_object('first', p.domestic_first_copy_usd, 'additional', p.domestic_additional_copy_usd) AS rate
    WHERE p.domestic_first_copy_usd IS NOT NULL
    UNION ALL
    SELECT region,
      jsonb_build_object('first', p.intl_first_copy_usd, 'additional', p.intl_additional_copy_usd)
    FROM unnest(ARRAY['us', 'ca', 'uk', 'eu', 'row']) AS region
    WHERE p.intl_first_copy_usd IS NOT NULL
  ) rates
)
WHERE p.flat_rates = '{}'::jsonb
  AND (p.domestic_first_copy_usd IS NOT NULL OR p.intl_first_copy_usd IS NOT NULL);
