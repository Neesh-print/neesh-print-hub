-- ============================================================
-- Payout and order safety
--
-- 1) publisher_transfers gets two new statuses:
--      'processing' - claimed by release-publisher-transfer while the Stripe
--                     transfer is in flight. Claiming is a single conditional
--                     UPDATE (pending -> processing), so two concurrent
--                     releases can never both pay the same row.
--      'cancelled'  - the order was fully refunded (or the dispute was lost)
--                     before the payout went out. Never releasable.
--
-- 2) publisher_transfers.hold_reason gains 'refund_review' and 'dispute'.
--    A held row stays 'pending' but release-publisher-transfer skips it.
--    ('awaiting_invoice_payment' and 'awaiting_label' are kept unchanged.)
--
-- 3) publisher_transfers.reversal_needed flags payouts that already went out
--    for an order that was later refunded or disputed. An admin decides
--    whether to reverse the transfer in Stripe; nothing is reversed
--    automatically.
--
-- 4) orders gets UNIQUE (stripe_session_id, magazine_id), so a retried or
--    concurrent checkout.session.completed webhook can't create duplicate
--    orders (or decrement inventory twice). NULL session IDs (net-terms
--    orders) never conflict with each other.
-- ============================================================

-- 1) Transfer statuses -------------------------------------------------------
-- The original CHECK was declared inline, so look its name up instead of
-- assuming Postgres' generated name.
DO $$
DECLARE
  v_constraint text;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.publisher_transfers'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%hold_reason%'
  LOOP
    EXECUTE format('ALTER TABLE public.publisher_transfers DROP CONSTRAINT %I', v_constraint);
  END LOOP;
END $$;

ALTER TABLE public.publisher_transfers
  ADD CONSTRAINT publisher_transfers_status_check
  CHECK (status IN ('pending', 'processing', 'transferred', 'failed', 'cancelled'));

-- 2) Hold reasons ---------------------------------------------------------------
DO $$
DECLARE
  v_constraint text;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.publisher_transfers'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%hold_reason%'
  LOOP
    EXECUTE format('ALTER TABLE public.publisher_transfers DROP CONSTRAINT %I', v_constraint);
  END LOOP;
END $$;

ALTER TABLE public.publisher_transfers
  ADD CONSTRAINT publisher_transfers_hold_reason_check
  CHECK (hold_reason IS NULL OR hold_reason IN (
    'awaiting_invoice_payment', 'awaiting_label', 'refund_review', 'dispute'
  ));

-- 3) Reversal flag ------------------------------------------------------------
ALTER TABLE public.publisher_transfers
  ADD COLUMN IF NOT EXISTS reversal_needed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

COMMENT ON COLUMN public.publisher_transfers.reversal_needed IS
  'True when the payout already went out but the order was later refunded or disputed. '
  'An admin should review and, if appropriate, reverse the transfer in Stripe.';

CREATE INDEX IF NOT EXISTS idx_publisher_transfers_reversal_needed
  ON public.publisher_transfers(reversal_needed)
  WHERE reversal_needed;

-- 4) One order per magazine per Checkout Session -----------------------------
-- Fail loudly (rather than silently skipping the constraint) if duplicates
-- already exist. They must be merged or removed by hand first.
DO $$
DECLARE
  v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT 1
    FROM public.orders
    WHERE stripe_session_id IS NOT NULL
    GROUP BY stripe_session_id, magazine_id
    HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION
      'Found % (stripe_session_id, magazine_id) pair(s) with duplicate orders. '
      'Resolve them before applying this migration: '
      'SELECT stripe_session_id, magazine_id, count(*) FROM public.orders '
      'WHERE stripe_session_id IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;',
      v_dupes;
  END IF;
END $$;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_session_magazine_unique;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_session_magazine_unique UNIQUE (stripe_session_id, magazine_id);
