# send-image-reminders

Weekly job that emails publishers whose **active** titles are missing a cover
image. Each title is reminded at most **4 times** (`image_reminder_count < 4`)
and stops as soon as a cover image is uploaded (an imageless title is the only
thing the job selects). One email per publisher lists all of their affected
titles.

## Prerequisites

1. **Migration applied** — `20260721010000_add_image_reminder_tracking.sql`
   adds `magazines.image_reminder_count` / `image_reminder_last_sent_at` and the
   `bump_image_reminders(uuid[])` function.
2. **Secrets set** on the project (Dashboard → Edge Functions → Secrets, or
   `supabase secrets set`):
   - `RESEND_API_KEY` — already used by the other email functions.
   - `CRON_SECRET` — a random string; the scheduler must send it as the
     `x-cron-secret` header.
   - `APP_URL` — base URL of the retailer/publisher app (used for the
     "Add a cover image" links, e.g. `https://app.neesh.art`). Defaults to
     `https://app.neesh.art` if unset.
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## Deploy

```bash
supabase functions deploy send-image-reminders
```

## Manual test (send once, right now)

```bash
curl -i -X POST "https://<project-ref>.functions.supabase.co/send-image-reminders" \
  -H "x-cron-secret: <CRON_SECRET>"
```

Response: `{ "ok": true, "publishersEmailed": N, "titles": M, "failures": [] }`.
Re-running immediately will pick up fewer titles as counters climb toward 4.

## Schedule weekly (pg_cron + pg_net)

`pg_cron` is not installed by default on this project (`pg_net` is). Enable
`pg_cron` in Dashboard → Database → Extensions, then run this once in the SQL
editor (store the secret in Vault, don't inline it):

```sql
-- store the cron secret once
select vault.create_secret('<CRON_SECRET>', 'image_reminder_cron_secret');

-- every Monday at 15:00 UTC
select cron.schedule(
  'weekly-image-reminders',
  '0 15 * * 1',
  $$
  select net.http_post(
    url     := 'https://<project-ref>.functions.supabase.co/send-image-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                        where name = 'image_reminder_cron_secret')
    )
  );
  $$
);
```

To change the cadence edit the cron expression; to stop it:
`select cron.unschedule('weekly-image-reminders');`

## Notes

- The 4-reminder cap is per title (`image_reminder_count`). A publisher who adds
  a new imageless title later starts that title's own 4-week cycle.
- Counters are only bumped for titles whose email actually sent, so a Resend
  failure means that publisher is retried next run rather than silently burned.
