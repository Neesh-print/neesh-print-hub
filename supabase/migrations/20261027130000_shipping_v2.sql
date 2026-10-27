-- =============================================================================
-- Shipping at checkout + Shippo labels (shipping_v2)
--
-- Tickets T1, T18 and the shipping_v2 flag. Live Shippo rates are the default
-- for every publisher; publisher flat rates are an optional override. There are
-- no Neesh flat defaults.
--
-- Note on T1: the full ships-from address (street, phone) lives in
-- publisher_shipping_settings, not on publishers, because publishers rows are
-- readable by anyone ("Anyone can view verified publishers",
-- "Anyone can view publisher info for active magazines"). Only fields that are
-- safe to show spaces (country, minimum, international toggle, rate mode and
-- flat rates) sit on publishers.
-- =============================================================================

-- 1) Feature flag and config (single row) -------------------------------------
CREATE TABLE IF NOT EXISTS public.shipping_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  shipping_v2_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  healthy_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 25,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.shipping_config (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.shipping_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read shipping config" ON public.shipping_config;
CREATE POLICY "Anyone can read shipping config"
  ON public.shipping_config FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can update shipping config" ON public.shipping_config;
CREATE POLICY "Admins can update shipping config"
  ON public.shipping_config FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON COLUMN public.shipping_config.shipping_v2_enabled IS
  'Feature flag for shipping at checkout. Off = checkout behaves as before (no shipping charged).';

-- 2) Publisher shipping fields (public-safe) -----------------------------------
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS ships_from_country CHAR(2),
  ADD COLUMN IF NOT EXISTS shipping_rate_mode TEXT NOT NULL DEFAULT 'live'
    CHECK (shipping_rate_mode IN ('live', 'flat')),
  ADD COLUMN IF NOT EXISTS domestic_first_copy_usd NUMERIC(8,2)
    CHECK (domestic_first_copy_usd IS NULL OR domestic_first_copy_usd BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS domestic_additional_copy_usd NUMERIC(8,2)
    CHECK (domestic_additional_copy_usd IS NULL OR domestic_additional_copy_usd BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS intl_first_copy_usd NUMERIC(8,2)
    CHECK (intl_first_copy_usd IS NULL OR intl_first_copy_usd BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS intl_additional_copy_usd NUMERIC(8,2)
    CHECK (intl_additional_copy_usd IS NULL OR intl_additional_copy_usd BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ships_internationally BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS uses_neesh_labels BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS packaging_preset TEXT NOT NULL DEFAULT 'auto'
    CHECK (packaging_preset IN ('auto', 'envelope', 'padded_mailer', 'box')),
  ADD COLUMN IF NOT EXISTS intl_min_copies INTEGER NOT NULL DEFAULT 5
    CHECK (intl_min_copies >= 1),
  ADD COLUMN IF NOT EXISTS shipping_rates_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.publishers.shipping_rate_mode IS
  'live = Shippo rates from the ships-from address (default). flat = the four *_copy_usd fields.';
COMMENT ON COLUMN public.publishers.intl_min_copies IS
  'Minimum copies per order across this publisher''s titles when the order is international. '
  'Applies on top of each title''s minimum_order_quantity.';

-- 3) Private ships-from address -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.publisher_shipping_settings (
  publisher_id UUID PRIMARY KEY REFERENCES public.publishers(id) ON DELETE CASCADE,
  -- { name, company, phone, email, line1, line2, city, state, postal_code, country }
  ships_from_address JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_publisher_shipping_settings_updated_at ON public.publisher_shipping_settings;
CREATE TRIGGER set_publisher_shipping_settings_updated_at
  BEFORE UPDATE ON public.publisher_shipping_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.publisher_shipping_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publishers manage own shipping settings" ON public.publisher_shipping_settings;
CREATE POLICY "Publishers manage own shipping settings"
  ON public.publisher_shipping_settings FOR ALL TO authenticated
  USING (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()))
  WITH CHECK (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins read shipping settings" ON public.publisher_shipping_settings;
CREATE POLICY "Admins read shipping settings"
  ON public.publisher_shipping_settings FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4) Stored quotes (what the cart showed and checkout charges) ----------------
CREATE TABLE IF NOT EXISTS public.shipping_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  retailer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  items JSONB NOT NULL,                    -- [{ magazine_id, quantity }]
  items_key TEXT NOT NULL,
  destination JSONB NOT NULL,              -- address snapshot
  destination_key TEXT NOT NULL,
  origin_country CHAR(2) NOT NULL,
  destination_country CHAR(2) NOT NULL,
  zone TEXT NOT NULL CHECK (zone IN ('domestic', 'international')),
  copies INTEGER NOT NULL,
  weight_grams INTEGER,
  parcel JSONB,
  shipping_usd NUMERIC(10,2) NOT NULL,
  rate_source TEXT NOT NULL CHECK (rate_source IN ('shippo', 'flat')),
  shippo_shipment_id TEXT,
  shippo_rate_id TEXT,
  carrier TEXT,
  service TEXT,
  service_token TEXT,
  rate_amount_local NUMERIC(10,2),
  rate_currency_local TEXT,
  estimated_days INTEGER,
  duties_paid BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_shipping_quotes_retailer ON public.shipping_quotes(retailer_user_id, created_at DESC);

ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Retailers read own quotes" ON public.shipping_quotes;
CREATE POLICY "Retailers read own quotes"
  ON public.shipping_quotes FOR SELECT TO authenticated
  USING (retailer_user_id = auth.uid());
-- Writes: service role only (edge functions).

-- 5) Raw carrier rate cache (service role only) --------------------------------
CREATE TABLE IF NOT EXISTS public.shipping_rate_cache (
  cache_key TEXT PRIMARY KEY,              -- origin|dest postal|dest country|grams|packaging
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  result JSONB NOT NULL
);

ALTER TABLE public.shipping_rate_cache ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) reads or writes.

-- 6) Shipments (one parcel per publisher per checkout) -------------------------
CREATE TABLE IF NOT EXISTS public.order_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_session_id TEXT NOT NULL,
  quote_id UUID REFERENCES public.shipping_quotes(id) ON DELETE SET NULL,
  retailer_id UUID NOT NULL,               -- users.id, same as orders.retailer_id
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  zone TEXT NOT NULL CHECK (zone IN ('domestic', 'international')),
  origin_country CHAR(2),
  destination_country CHAR(2),
  destination_address JSONB,
  copies INTEGER NOT NULL,
  weight_grams INTEGER,
  parcel JSONB,
  customs JSONB,
  shipping_usd NUMERIC(10,2) NOT NULL,     -- what the space paid
  rate_source TEXT NOT NULL CHECK (rate_source IN ('shippo', 'flat')),
  uses_neesh_labels BOOLEAN NOT NULL DEFAULT FALSE,
  shippo_rate_id TEXT,
  quote_expires_at TIMESTAMPTZ,
  shippo_transaction_id TEXT,
  label_cost_usd NUMERIC(10,2),
  label_url TEXT,
  commercial_invoice_url TEXT,
  carrier TEXT,
  service TEXT,
  service_token TEXT,
  estimated_days INTEGER,
  duties_paid BOOLEAN NOT NULL DEFAULT FALSE,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_shipment'
    CHECK (status IN ('awaiting_shipment', 'awaiting_label', 'label_ready', 'needs_review',
                      'shipped', 'delivered', 'cancelled')),
  review_reason TEXT,
  CONSTRAINT unique_shipment_per_session_publisher UNIQUE (stripe_session_id, publisher_id)
);

CREATE INDEX IF NOT EXISTS idx_order_shipments_publisher ON public.order_shipments(publisher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_shipments_retailer ON public.order_shipments(retailer_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_tracking ON public.order_shipments(tracking_number);

DROP TRIGGER IF EXISTS set_order_shipments_updated_at ON public.order_shipments;
CREATE TRIGGER set_order_shipments_updated_at
  BEFORE UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Retailers read own shipments" ON public.order_shipments;
CREATE POLICY "Retailers read own shipments"
  ON public.order_shipments FOR SELECT TO authenticated
  USING (retailer_id = auth.uid());

DROP POLICY IF EXISTS "Publishers read own shipments" ON public.order_shipments;
CREATE POLICY "Publishers read own shipments"
  ON public.order_shipments FOR SELECT TO authenticated
  USING (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins read all shipments" ON public.order_shipments;
CREATE POLICY "Admins read all shipments"
  ON public.order_shipments FOR SELECT TO authenticated
  USING (public.is_admin());
-- Writes: service role only (stripe-webhook, buy-label, shippo-webhook).

-- 7) Orders link to their shipment ---------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.order_shipments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label_url TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_shipment ON public.orders(shipment_id);

-- 8) Transfers: goods vs shipping ----------------------------------------------
ALTER TABLE public.publisher_transfers
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'goods'
    CHECK (kind IN ('goods', 'shipping')),
  ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.order_shipments(id) ON DELETE CASCADE;

ALTER TABLE public.publisher_transfers ALTER COLUMN order_id DROP NOT NULL;

-- Goods rows point at an order; shipping rows point at a shipment. Keeping
-- shipment_id null on goods rows lets a plain unique constraint make shipping
-- transfers idempotent (one per shipment).
ALTER TABLE public.publisher_transfers
  DROP CONSTRAINT IF EXISTS publisher_transfers_kind_target_check;
ALTER TABLE public.publisher_transfers
  ADD CONSTRAINT publisher_transfers_kind_target_check CHECK (
    (kind = 'goods' AND order_id IS NOT NULL AND shipment_id IS NULL)
    OR (kind = 'shipping' AND shipment_id IS NOT NULL AND order_id IS NULL)
  );

ALTER TABLE public.publisher_transfers
  DROP CONSTRAINT IF EXISTS unique_shipping_transfer_per_shipment;
ALTER TABLE public.publisher_transfers
  ADD CONSTRAINT unique_shipping_transfer_per_shipment UNIQUE (shipment_id);

-- Shipping transfers for Neesh-label publishers wait until the label is bought,
-- so the label cost can be deducted first.
ALTER TABLE public.publisher_transfers
  DROP CONSTRAINT IF EXISTS publisher_transfers_hold_reason_check;
ALTER TABLE public.publisher_transfers
  ADD CONSTRAINT publisher_transfers_hold_reason_check
    CHECK (hold_reason IS NULL OR hold_reason IN (
      'awaiting_invoice_payment', 'awaiting_label', 'refund_review', 'dispute'
    ));

-- 9) Backfill ships_from_country ----------------------------------------------
-- First the most common origin_country_code across the publisher's titles,
-- then the country on their application.
WITH title_country AS (
  SELECT DISTINCT ON (publisher_id) publisher_id, upper(origin_country_code) AS code
  FROM public.magazines
  WHERE origin_country_code ~* '^[a-z]{2}$'
  GROUP BY publisher_id, upper(origin_country_code)
  ORDER BY publisher_id, count(*) DESC
)
UPDATE public.publishers p
SET ships_from_country = tc.code
FROM title_country tc
WHERE p.id = tc.publisher_id AND p.ships_from_country IS NULL;

UPDATE public.publishers p
SET ships_from_country = upper(pa.shipping_country)
FROM public.publisher_applications pa
WHERE pa.user_id = p.user_id
  AND p.ships_from_country IS NULL
  AND pa.shipping_country ~* '^[a-z]{2}$';

-- Prefill the ships-from city and country from the application so the
-- settings form is not empty. Street and postal code still need the publisher.
INSERT INTO public.publisher_shipping_settings (publisher_id, ships_from_address)
SELECT p.id,
       jsonb_strip_nulls(jsonb_build_object(
         'name', p.company_name,
         'city', pa.shipping_city,
         'state', pa.shipping_state,
         'country', p.ships_from_country))
FROM public.publishers p
JOIN public.publisher_applications pa ON pa.user_id = p.user_id
WHERE p.ships_from_country IS NOT NULL
ON CONFLICT (publisher_id) DO NOTHING;

-- Backfill report for Gem: approved publishers still without a country.
-- Re-run this query after applying to get the list for the PR.
--   SELECT id, company_name FROM public.publishers
--   WHERE ships_from_country IS NULL AND application_status = 'approved'
--   ORDER BY company_name;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, company_name FROM public.publishers
    WHERE ships_from_country IS NULL AND application_status = 'approved'
    ORDER BY company_name
  LOOP
    RAISE NOTICE 'shipping_v2 backfill: no ships_from_country for publisher % (%)', r.company_name, r.id;
  END LOOP;
END $$;
