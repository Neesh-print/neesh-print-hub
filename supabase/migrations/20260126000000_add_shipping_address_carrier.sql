-- Add shipping_address and carrier columns to orders table
-- Migration: Add shipping address and carrier support

-- Add shipping_address column (JSONB to store full Stripe shipping details)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- Add carrier column for tracking carrier info
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS carrier TEXT;

-- Add comment explaining the shipping_address structure
COMMENT ON COLUMN public.orders.shipping_address IS 'Shipping address from Stripe. Structure: { name, address: { line1, line2, city, state, postal_code, country } }';

-- Add comment for carrier
COMMENT ON COLUMN public.orders.carrier IS 'Shipping carrier (e.g., USPS, UPS, FedEx, DHL)';

-- Create index on carrier for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON public.orders(carrier) WHERE carrier IS NOT NULL;
