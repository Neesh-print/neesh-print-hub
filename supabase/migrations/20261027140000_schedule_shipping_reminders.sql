-- Twice-weekly reminder (shipping_v2) for approved publishers with no
-- ships-from address. Spaces can't check out a publisher's titles until it's
-- in. The job stops emailing a publisher once their address is complete.
--
-- Tuesday and Friday, so it doesn't land the same morning as the Monday
-- cover-image or Thursday price reminders.
SELECT cron.unschedule('send-shipping-reminders-twice-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-shipping-reminders-twice-weekly');

SELECT cron.schedule(
  'send-shipping-reminders-twice-weekly',
  '0 15 * * 2,5',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-shipping-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
