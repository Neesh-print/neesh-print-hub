-- Persist Stripe Connect onboarding status on the publishers table.
-- Previously only stripe_account_id was stored; account state (charges/payouts
-- enabled, outstanding requirements) was fetched live from Stripe on every view,
-- so a restricted account was indistinguishable from a fully onboarded one in the
-- database. These columns are written by the stripe-webhook account.updated
-- handler and by the one-off backfill script.

ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_requirements_due JSONB,
  ADD COLUMN IF NOT EXISTS stripe_account_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_status_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.publishers.stripe_charges_enabled IS 'Stripe account.charges_enabled — mirrored from the account.updated webhook';
COMMENT ON COLUMN public.publishers.stripe_payouts_enabled IS 'Stripe account.payouts_enabled — whether the publisher can receive payouts yet';
COMMENT ON COLUMN public.publishers.stripe_details_submitted IS 'Stripe account.details_submitted — whether onboarding was completed and handed to Stripe';
COMMENT ON COLUMN public.publishers.stripe_requirements_due IS 'Outstanding Stripe requirements (currently_due / past_due / disabled_reason) as returned by Stripe';
COMMENT ON COLUMN public.publishers.stripe_account_created_at IS 'When the Stripe connected account was created — used to schedule onboarding nudges';
COMMENT ON COLUMN public.publishers.stripe_status_updated_at IS 'When the Stripe status columns above were last written';

-- Partial index for the admin drop-off view and the nudge cron: quickly find
-- connected accounts that cannot yet receive payouts.
CREATE INDEX IF NOT EXISTS idx_publishers_stripe_payouts_pending
  ON public.publishers(stripe_payouts_enabled)
  WHERE stripe_account_id IS NOT NULL AND stripe_payouts_enabled = false;
