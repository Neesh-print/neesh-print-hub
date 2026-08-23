-- Backfill the schema behind send-image-reminders and send-onboarding-nudges.
--
-- Both functions were deployed straight to the project and never committed, and
-- so were the database objects they depend on. Pulling only the function source
-- into the repo would leave them unrunnable anywhere else, so this captures the
-- objects as they exist in production.
--
-- Everything here is written idempotently: against the live project it is a
-- no-op, and against a fresh database it reproduces what the jobs need.

-- ---------------------------------------------------------------------------
-- send-image-reminders: per-title counters + the counter bump helper
-- ---------------------------------------------------------------------------
ALTER TABLE public.magazines
  ADD COLUMN IF NOT EXISTS image_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_reminder_last_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.bump_image_reminders(mag_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  update public.magazines
     set image_reminder_count = image_reminder_count + 1,
         image_reminder_last_sent_at = now()
   where id = any(mag_ids);
$function$;

-- Service role only. See 20260819090000_price_reminders.sql: left open, any
-- anon caller could inflate a counter and silently suppress reminders.
REVOKE ALL ON FUNCTION public.bump_image_reminders(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_image_reminders(uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- send-onboarding-nudges: the sent-nudge ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_onboarding_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  nudge_day integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- The function inserts before emailing and treats a conflict here as "another
-- run already claimed this milestone", so this constraint is what prevents a
-- double send when two runs overlap. It is load-bearing, not just hygiene.
CREATE UNIQUE INDEX IF NOT EXISTS unique_publisher_nudge_day
  ON public.stripe_onboarding_nudges (publisher_id, nudge_day);

CREATE INDEX IF NOT EXISTS idx_stripe_onboarding_nudges_publisher
  ON public.stripe_onboarding_nudges (publisher_id);

ALTER TABLE public.stripe_onboarding_nudges ENABLE ROW LEVEL SECURITY;

-- The job itself runs as the service role and bypasses RLS; this policy only
-- exposes the ledger to admins for inspection.
DROP POLICY IF EXISTS "Admins can view onboarding nudges" ON public.stripe_onboarding_nudges;
CREATE POLICY "Admins can view onboarding nudges"
  ON public.stripe_onboarding_nudges
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role::text = 'admin'
  ));

-- ---------------------------------------------------------------------------
-- Schedules — deliberately NOT created here
-- ---------------------------------------------------------------------------
-- Both schedules already exist on the live project and are left alone:
--
--   send-image-reminders-weekly    '0 15 * * 1'   active
--   send-onboarding-nudges-daily   '0 15 * * *'   INACTIVE
--
-- The onboarding nudge is switched off on purpose. cron.schedule() always
-- creates a job in the active state and there is no privilege here to switch
-- one back off (UPDATE on cron.job is denied to the migration role), so
-- scheduling it from a migration would silently re-enable a job somebody
-- turned off. Recording the schedules as documentation instead.
--
-- To (re)create them by hand, as a role that owns the cron schema:
--
--   SELECT cron.schedule('send-image-reminders-weekly', '0 15 * * 1', $cron$
--     select net.http_post(
--       url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
--              || '/functions/v1/send-image-reminders',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
--       ),
--       body := '{}'::jsonb);
--   $cron$);
--
--   SELECT cron.schedule('send-onboarding-nudges-daily', '0 15 * * *', $cron$
--     SELECT net.http_post(
--       url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
--              || '/functions/v1/send-onboarding-nudges',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
--       ),
--       body := '{}'::jsonb);
--   $cron$);
--   -- then, to match production: SELECT cron.alter_job(
--   --   (SELECT jobid FROM cron.job WHERE jobname = 'send-onboarding-nudges-daily'),
--   --   active := false);
