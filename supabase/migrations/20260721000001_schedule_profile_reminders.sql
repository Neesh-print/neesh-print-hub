-- Daily job that pings the send-profile-reminders edge function.
-- The function itself decides who is due (approved >= 7 days ago, not yet
-- reminded), so this job just needs to fire once a day.
--
-- SECRETS (create these once, they are NOT stored in git):
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<same value as the function''s REMINDER_SECRET env var>', 'reminder_secret');
--
-- The edge function must have env vars set (Supabase dashboard > Edge Functions):
--   REMINDER_SECRET, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with this name before (re)creating it.
SELECT cron.unschedule('send-profile-reminders-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-profile-reminders-daily'
);

-- 15:00 UTC daily.
SELECT cron.schedule(
  'send-profile-reminders-daily',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-profile-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
