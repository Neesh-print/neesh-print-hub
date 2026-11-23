-- Demand-signal Automation 5: the Monday demand rollup to Gem.
-- 14:00 UTC is 9am ET during EST (10am during EDT), matching the other
-- reminder jobs. send-demand-rollup skips the send on an empty week.
select cron.schedule(
  'send-demand-rollup-weekly',
  '0 14 * * 1',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-demand-rollup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  $cron$
);
