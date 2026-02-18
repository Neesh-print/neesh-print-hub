-- Publisher Transfers table
-- Tracks pending and completed transfers from the Neesh platform account
-- to individual publisher Stripe Connect accounts.

CREATE TABLE IF NOT EXISTS public.publisher_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  gross_amount NUMERIC(10,2) NOT NULL,       -- what the retailer paid (wholesale * 1.10 * qty)
  platform_fee NUMERIC(10,2) NOT NULL,       -- the 10% Neesh keeps
  net_amount NUMERIC(10,2) NOT NULL,         -- what the publisher receives (wholesale * qty)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'transferred', 'failed')),
  stripe_transfer_id TEXT,
  released_by UUID REFERENCES auth.users(id),
  released_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_order_transfer UNIQUE (order_id)
);

-- Indexes
CREATE INDEX idx_publisher_transfers_publisher ON public.publisher_transfers(publisher_id);
CREATE INDEX idx_publisher_transfers_status ON public.publisher_transfers(status);

-- Updated-at trigger
CREATE TRIGGER set_publisher_transfers_updated_at
  BEFORE UPDATE ON public.publisher_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.publisher_transfers ENABLE ROW LEVEL SECURITY;

-- Publishers can SELECT their own rows
CREATE POLICY "Publishers can view own transfers"
  ON public.publisher_transfers
  FOR SELECT
  USING (
    publisher_id IN (
      SELECT id FROM public.publishers WHERE user_id = auth.uid()
    )
  );

-- Admins can SELECT all rows
CREATE POLICY "Admins can view all transfers"
  ON public.publisher_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can UPDATE all rows (for releasing transfers)
CREATE POLICY "Admins can update all transfers"
  ON public.publisher_transfers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );
