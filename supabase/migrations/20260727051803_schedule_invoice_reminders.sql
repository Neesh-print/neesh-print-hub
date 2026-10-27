CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('send-invoice-reminders-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-invoice-reminders-daily'
);

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
);;
