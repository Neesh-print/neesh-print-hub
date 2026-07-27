-- Daily job that pings the send-invoice-reminders edge function.
-- The function itself marks overdue invoices and decides who is due, so this job
-- just needs to fire once a day.
--
-- Reuses the SAME Vault secrets as send-profile-reminders (project_url,
-- reminder_secret) — nothing new to create. See 20260721000001 for the setup:
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<REMINDER_SECRET env value>', 'reminder_secret');
--
-- The edge function must have env vars set (Supabase dashboard > Edge Functions):
--   REMINDER_SECRET, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with this name before (re)creating it.
SELECT cron.unschedule('send-invoice-reminders-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-invoice-reminders-daily'
);

-- 16:00 UTC daily (1h after the profile-reminders job to avoid overlap).
SELECT cron.schedule(
  'send-invoice-reminders-daily',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-invoice-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
