-- Add stripe_customer_id to profiles table for persisting Stripe customer IDs
-- Used by create-checkout edge function to avoid creating duplicate Stripe customers
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for fast lookups when fetching existing Stripe customer
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
  ON public.profiles(stripe_customer_id);
