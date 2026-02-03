-- Add Stripe Connect account ID to publishers table  
-- This stores the Stripe Connected Account ID for each publisher

ALTER TABLE public.publishers
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Add index for lookup by stripe account
CREATE INDEX IF NOT EXISTS idx_publishers_stripe_account_id
ON public.publishers(stripe_account_id);

-- Comment on the column
COMMENT ON COLUMN public.publishers.stripe_account_id IS 'Stripe Connect account ID for receiving payouts';
