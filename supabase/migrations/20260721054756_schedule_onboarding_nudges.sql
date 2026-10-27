-- Schedule the daily onboarding-nudge job. pg_cron and pg_net are already
-- installed on this project.
--
-- MANUAL SETUP REQUIRED before nudges will send:
--   1. Deploy the send-onboarding-nudges edge function.
--   2. Set the function's CRON_SECRET environment variable to a random value.
--   3. Store that same value as a Vault secret named 'cron_secret':
--        select vault.create_secret('<the-same-value>', 'cron_secret');
-- Until the Vault secret exists the job still runs but the function rejects it
-- (401), so no emails go out — safe, just inert.

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-onboarding-nudges-daily') THEN
    PERFORM cron.unschedule('send-onboarding-nudges-daily');
  END IF;
END
$do$;

-- 15:00 UTC daily. The job posts to the edge function with the shared secret.
SELECT cron.schedule(
  'send-onboarding-nudges-daily',
  '0 15 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://smfzrubkyxejzkblrrjr.supabase.co/functions/v1/send-onboarding-nudges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
