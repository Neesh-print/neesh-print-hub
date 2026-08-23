-- ============================================================
-- Net 14 / Net 30 payment terms — Model B (publisher waits)
--
-- Approved retailers can buy on Net 14 / Net 30. The retailer is invoiced via
-- Stripe Invoicing and pays later; the publisher payout is HELD (in the existing
-- publisher_transfers ledger) until the retailer's invoice is paid. Neesh carries
-- no credit risk or float.
--
-- Additive & idempotent: existing rows backfill via column defaults (all prior
-- orders were pay-now/paid).
-- ============================================================

-- 1) Retailer credit / terms fields -----------------------------------------
ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS payment_terms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS net_terms_days INTEGER NOT NULL DEFAULT 0
    CHECK (net_terms_days IN (0, 14, 30)),
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_status TEXT NOT NULL DEFAULT 'none'
    CHECK (terms_status IN ('none', 'pending', 'approved', 'suspended')),
  ADD COLUMN IF NOT EXISTS terms_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_approved_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.retailers.credit_limit IS
  'Max total outstanding (open+overdue) invoice balance allowed on net terms, USD.';

-- 2) Invoices table = the order header that groups line items ----------------
--    retailer_id stores the AUTH USER ID, to match the existing
--    orders.retailer_id convention (orders.retailer_id = auth.uid()).
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL,
  stripe_invoice_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  terms_days INTEGER NOT NULL CHECK (terms_days IN (14, 30)),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,   -- sum(wholesale * 1.10 * qty)
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'overdue', 'void', 'uncollectible')),
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_retailer ON public.invoices(retailer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe   ON public.invoices(stripe_invoice_id);

DROP TRIGGER IF EXISTS set_invoices_updated_at ON public.invoices;
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Split payment from fulfillment on orders --------------------------------
--    Existing rows are all pay-now/paid, so defaults backfill correctly.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pay_now'
    CHECK (payment_method IN ('pay_now', 'net14', 'net30')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('unpaid', 'invoiced', 'paid', 'overdue', 'written_off', 'refunded')),
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_invoice        ON public.orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- 4) Hold flag on the existing payout ledger ---------------------------------
ALTER TABLE public.publisher_transfers
  ADD COLUMN IF NOT EXISTS hold_reason TEXT
    CHECK (hold_reason IS NULL OR hold_reason IN ('awaiting_invoice_payment')),
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);

COMMENT ON COLUMN public.publisher_transfers.hold_reason IS
  'When set, transfer is held until the retailer pays the linked invoice (net terms). '
  'NULL = releasable now (pay-now order).';

CREATE INDEX IF NOT EXISTS idx_publisher_transfers_invoice
  ON public.publisher_transfers(invoice_id);

-- 5) RLS for invoices --------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Retailers can view their own invoices" ON public.invoices;
CREATE POLICY "Retailers can view their own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (retailer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
CREATE POLICY "Admins can view all invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
-- (Edge functions write via the service role and bypass RLS.)

-- 6) Helper functions --------------------------------------------------------

-- Current outstanding balance for a retailer (open + overdue invoices).
CREATE OR REPLACE FUNCTION public.retailer_outstanding_balance(p_retailer_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount_due), 0)
  FROM public.invoices
  WHERE retailer_id = p_retailer_id
    AND status IN ('open', 'overdue');
$$;

GRANT EXECUTE ON FUNCTION public.retailer_outstanding_balance(UUID) TO authenticated, service_role;

-- Flip open invoices to overdue once past due (run daily by the cron).
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  WITH upd AS (
    UPDATE public.invoices
    SET status = 'overdue'
    WHERE status = 'open' AND due_at < now()
    RETURNING id
  )
  SELECT count(*) INTO n FROM upd;

  UPDATE public.orders
  SET payment_status = 'overdue'
  WHERE invoice_id IN (SELECT id FROM public.invoices WHERE status = 'overdue')
    AND payment_status = 'invoiced';

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;

-- Invoices needing a reminder email (due within 3 days or overdue, not
-- reminded in the last 3 days). Mirrors due_profile_reminders().
CREATE OR REPLACE FUNCTION public.due_invoice_reminders()
RETURNS TABLE (
  invoice_id UUID,
  retailer_id UUID,
  email TEXT,
  shop_name TEXT,
  total NUMERIC,
  amount_due NUMERIC,
  due_at TIMESTAMPTZ,
  hosted_invoice_url TEXT,
  reminder_kind TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.retailer_id, u.email, r.shop_name,
         i.total, i.amount_due, i.due_at, i.hosted_invoice_url,
         CASE WHEN i.due_at < now() THEN 'overdue' ELSE 'due_soon' END
  FROM public.invoices i
  JOIN public.users u          ON u.id = i.retailer_id
  LEFT JOIN public.retailers r ON r.user_id = i.retailer_id
  WHERE i.status IN ('open', 'overdue')
    AND (i.last_reminder_at IS NULL OR i.last_reminder_at < now() - interval '3 days')
    AND i.due_at < now() + interval '3 days';
$$;

GRANT EXECUTE ON FUNCTION public.due_invoice_reminders() TO service_role;
