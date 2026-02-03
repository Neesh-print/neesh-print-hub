-- =============================================================
-- Stripe Checkout Support for Retailer Orders
-- Adds necessary columns and indexes for Stripe integration
-- =============================================================

-- Add stripe_session_id to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Add stripe_payment_intent_id (different from the generic payment_intent_id)
-- This specifically tracks Stripe payment intents
COMMENT ON COLUMN public.orders.payment_intent_id IS 'Stripe Payment Intent ID from completed checkout session';

-- Add index for quick lookup by Stripe session ID
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id
ON public.orders(stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

-- Add index for status lookups (important for order processing)
CREATE INDEX IF NOT EXISTS idx_orders_status
ON public.orders(status);

-- Update orders table to track more payment metadata
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stripe_payment_metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN public.orders.stripe_session_id IS 'Stripe Checkout Session ID - used to track the checkout session';
COMMENT ON COLUMN public.orders.stripe_payment_metadata IS 'Additional Stripe metadata (customer details, fees, etc.)';

-- Ensure payment_sessions table can track Stripe sessions properly
-- (This table already exists, just adding a comment for clarity)
COMMENT ON TABLE public.payment_sessions IS 'Tracks payment sessions including Stripe checkout sessions';
COMMENT ON COLUMN public.payment_sessions.session_id IS 'Stripe Checkout Session ID';

-- Create a function to calculate retailer price (wholesale + 10%)
CREATE OR REPLACE FUNCTION public.calculate_retailer_price(wholesale_price NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF wholesale_price IS NULL THEN
    RETURN NULL;
  END IF;

  -- Add 10% markup to wholesale price
  RETURN ROUND(wholesale_price * 1.10, 2);
END;
$$;

COMMENT ON FUNCTION public.calculate_retailer_price IS 'Calculates the retailer price by adding 10% markup to wholesale price';

-- =============================================================
-- RLS Policies for Order Security
-- =============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Retailers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Retailers can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Publishers can view orders for their magazines" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;

-- Retailers can view their own orders
CREATE POLICY "Retailers can view their own orders"
ON public.orders FOR SELECT
USING (
  retailer_id = auth.uid()
  OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- Retailers can create orders (via Stripe checkout)
CREATE POLICY "Retailers can create their own orders"
ON public.orders FOR INSERT
WITH CHECK (
  retailer_id = auth.uid()
);

-- Publishers can view orders for their magazines
CREATE POLICY "Publishers can view orders for their magazines"
ON public.orders FOR SELECT
USING (
  magazine_id IN (
    SELECT m.id FROM public.magazines m
    JOIN public.publishers p ON m.publisher_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- Admins can update order status
CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE
USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
);

-- =============================================================
-- Helper view for order details with pricing
-- =============================================================

DROP VIEW IF EXISTS public.order_details_with_pricing CASCADE;

CREATE OR REPLACE VIEW public.order_details_with_pricing AS
SELECT
  o.id,
  o.created_at,
  o.status,
  o.quantity,
  o.unit_price,
  o.total_price,
  o.stripe_session_id,
  o.payment_intent_id,
  o.retailer_id,
  m.id as magazine_id,
  m.title as magazine_title,
  m.cover_image_url,
  m.wholesale_price,
  m.publisher_id,
  p.company_name as publisher_name,
  u_pub.email as publisher_email,
  r.shop_name as retailer_shop_name,
  u_ret.email as retailer_email
FROM public.orders o
JOIN public.magazines m ON o.magazine_id = m.id
JOIN public.publishers p ON m.publisher_id = p.id
JOIN public.users u_pub ON p.user_id = u_pub.id
LEFT JOIN public.retailers r ON o.retailer_id = r.user_id
JOIN public.users u_ret ON o.retailer_id = u_ret.id;

COMMENT ON VIEW public.order_details_with_pricing IS 'Comprehensive view of orders with magazine, publisher, and retailer details';

-- Grant access to the view
GRANT SELECT ON public.order_details_with_pricing TO authenticated;
