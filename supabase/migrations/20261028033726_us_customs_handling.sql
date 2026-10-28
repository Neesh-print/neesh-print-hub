-- US customs handling at checkout (spec Oct 28, 2026).
--
-- Every parcel into the US from outside the US needs a customs entry, even
-- at $0 duty, and that entry costs money: a Zonos prepay fee on postal
-- parcels (the publisher pays it), a courier duty-handling fee on UPS, FedEx
-- and DHL Express (billed to Neesh's Shippo account). Spaces pay it as its
-- own line at checkout. The feature ships off with both fees at $0, so
-- nothing charges until the real fees are known.

-- 1) Settings (admins edit them; same RLS as healthy_margin_pct) ---------------
ALTER TABLE public.shipping_config
  ADD COLUMN IF NOT EXISTS customs_handling_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS customs_fee_postal_usd NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (customs_fee_postal_usd >= 0),
  ADD COLUMN IF NOT EXISTS customs_fee_courier_usd NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (customs_fee_courier_usd >= 0);

COMMENT ON COLUMN public.shipping_config.customs_handling_enabled IS
  'Charge spaces a US customs handling line on US-bound parcels from abroad. Off = no line.';
COMMENT ON COLUMN public.shipping_config.customs_fee_postal_usd IS
  'Per parcel, when the publisher prepays customs (post or own postage). Paid back to the publisher.';
COMMENT ON COLUMN public.shipping_config.customs_fee_courier_usd IS
  'Per parcel, when a courier carries it duties paid. Kept by Neesh to cover the courier''s bill.';

-- 2) What each quote and shipment charged, and where it goes -------------------
-- customs_route: 'publisher' (paid back in the shipping payout) or 'neesh'
-- (kept against the courier's Shippo invoice line); null when the parcel
-- needs no US customs entry.
ALTER TABLE public.shipping_quotes
  ADD COLUMN IF NOT EXISTS customs_usd NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (customs_usd >= 0),
  ADD COLUMN IF NOT EXISTS customs_route TEXT CHECK (customs_route IN ('publisher', 'neesh'));

ALTER TABLE public.order_shipments
  ADD COLUMN IF NOT EXISTS customs_usd NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (customs_usd >= 0),
  ADD COLUMN IF NOT EXISTS customs_route TEXT CHECK (customs_route IN ('publisher', 'neesh'));
