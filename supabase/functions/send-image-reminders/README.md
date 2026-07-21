# send-image-reminders

Weekly job that emails publishers whose **active** titles are missing a cover
image. Each title is reminded at most **4 times** (`image_reminder_count < 4`)
and stops as soon as a cover image is uploaded (an imageless title is the only
thing the job selects). One email per publisher lists all of their affected
titles, linking to `https://neesh.art/publisher/titles/:id/edit`.

Conventions match `send-profile-reminders` so both jobs share one secret and one
scheduler: shared-secret auth, dry-run mode, `BASE_URL = https://neesh.art`.

## Prerequisites

1. **Migration applied** — `20260721010000_add_image_reminder_tracking.sql`
   adds `magazines.image_reminder_count` / `image_reminder_last_sent_at` and the
   `bump_image_reminders(uuid[])` function.
2. **Secrets** (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
   - `REMINDER_SECRET` — same shared secret used by `send-profile-reminders`;
     the caller sends it as the `x-reminder-secret` header.
   - `RESEND_API_KEY` — already set (used by the other email functions).
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## Deploy

```bash
supabase functions deploy send-image-reminders
```

## Test safely (dry run — sends nothing, stamps nothing)

```bash
curl -s -X POST "https://smfzrubkyxejzkblrrjr.functions.supabase.co/send-image-reminders" \
  -H "x-reminder-secret: <REMINDER_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

Returns the publishers/titles that *would* be emailed. Add `"limit": 1` to cap
it. When you're happy, do a real single send with `-d '{"limit": 1}'`, then the
full run with `-d '{}'`.

## Schedule weekly (pg_cron + pg_net)

`pg_cron` is not installed by default on this project (`pg_net` is). Enable
`pg_cron` in Dashboard → Database → Extensions, then run once in the SQL editor
(store the secret in Vault, don't inline it):

```sql
select vault.create_secret('<REMINDER_SECRET>', 'reminder_secret');

-- every Monday at 15:00 UTC
select cron.schedule(
  'weekly-image-reminders',
  '0 15 * * 1',
  $$
  select net.http_post(
    url     := 'https://smfzrubkyxejzkblrrjr.functions.supabase.co/send-image-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Change cadence by editing the cron expression; stop with
`select cron.unschedule('weekly-image-reminders');`.

## Notes

- The 4-reminder cap is per title (`image_reminder_count`). A publisher who adds
  a new imageless title later starts that title's own 4-week cycle.
- Counters are bumped only for titles whose email actually sent, so a Resend
  failure retries that publisher next run instead of silently burning a reminder.
