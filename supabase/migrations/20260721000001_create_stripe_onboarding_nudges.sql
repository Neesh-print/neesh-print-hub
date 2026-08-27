-- Tracks onboarding reminder emails already sent to publishers who started but
-- did not finish Stripe payout onboarding. The unique constraint guarantees a
-- given publisher never receives the same day's nudge twice, even if the
-- scheduled job runs more than once.

CREATE TABLE IF NOT EXISTS public.stripe_onboarding_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  nudge_day INTEGER NOT NULL,                 -- which milestone this was: 2, 7, or 21
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_publisher_nudge_day UNIQUE (publisher_id, nudge_day)
);

CREATE INDEX IF NOT EXISTS idx_stripe_onboarding_nudges_publisher
  ON public.stripe_onboarding_nudges(publisher_id);

-- Enable RLS. Writes happen through the service role (which bypasses RLS) from
-- the scheduled function; admins may read the log.
ALTER TABLE public.stripe_onboarding_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view onboarding nudges"
  ON public.stripe_onboarding_nudges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );
