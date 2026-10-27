-- ============================================================
-- shipping_v2: hold self-shipped parcels' shipping payouts until tracking
--
-- Neesh-label shipping payouts are held as 'awaiting_label' until buy-label
-- deducts the label cost. Publishers who ship with their own labels had no
-- hold, so their shipping could be paid before the parcel went out. Their
-- shipping payout is now held as 'awaiting_tracking' (stripe-webhook sets
-- it) and released for payout as soon as the publisher adds a tracking
-- number to any order in the parcel.
--
-- Publishers can't write publisher_transfers or order_shipments, so the
-- hold is cleared by a SECURITY DEFINER trigger on orders. It only ever
-- clears 'awaiting_tracking'; refund-review and dispute holds stay.
-- ============================================================

-- 1) Hold reasons ---------------------------------------------------------------
ALTER TABLE public.publisher_transfers
  DROP CONSTRAINT IF EXISTS publisher_transfers_hold_reason_check;

ALTER TABLE public.publisher_transfers
  ADD CONSTRAINT publisher_transfers_hold_reason_check
  CHECK (hold_reason IS NULL OR hold_reason IN (
    'awaiting_invoice_payment', 'awaiting_label', 'awaiting_tracking', 'refund_review', 'dispute'
  ));

-- 2) Tracking added on an order releases its parcel's shipping hold -------------
CREATE OR REPLACE FUNCTION public.release_shipping_hold_on_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shipment_id IS NULL
     OR coalesce(btrim(NEW.tracking_number), '') = ''
     OR NEW.tracking_number IS NOT DISTINCT FROM OLD.tracking_number THEN
    RETURN NEW;
  END IF;

  -- Neesh-label parcels get their tracking from buy-label; leave them alone.
  UPDATE public.order_shipments
  SET tracking_number = coalesce(tracking_number, NEW.tracking_number),
      carrier = coalesce(carrier, NEW.carrier),
      status = CASE WHEN status = 'awaiting_shipment' THEN 'shipped' ELSE status END
  WHERE id = NEW.shipment_id
    AND NOT uses_neesh_labels;

  IF FOUND THEN
    UPDATE public.publisher_transfers
    SET hold_reason = NULL
    WHERE shipment_id = NEW.shipment_id
      AND kind = 'shipping'
      AND status = 'pending'
      AND hold_reason = 'awaiting_tracking';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.release_shipping_hold_on_tracking() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS release_shipping_hold_on_tracking ON public.orders;
CREATE TRIGGER release_shipping_hold_on_tracking
  AFTER UPDATE OF tracking_number ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.release_shipping_hold_on_tracking();

-- 3) Backfill: unpaid self-ship shipping payouts with no tracking yet -----------
UPDATE public.publisher_transfers t
SET hold_reason = 'awaiting_tracking'
FROM public.order_shipments s
WHERE t.shipment_id = s.id
  AND t.kind = 'shipping'
  AND t.status = 'pending'
  AND t.hold_reason IS NULL
  AND NOT s.uses_neesh_labels
  AND coalesce(btrim(s.tracking_number), '') = ''
  AND NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.shipment_id = s.id
      AND coalesce(btrim(o.tracking_number), '') <> ''
  );
