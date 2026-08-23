-- Weekly reminder for titles with no wholesale price, plus a guard so the
-- "your page is live" nudge doesn't point publishers at an empty page.
--
-- Context: approve-application now creates a title inactive when the
-- application carried no price (an unpriced title can be added to a cart but
-- create-checkout rejects it at payment). Nothing told the publisher to go add
-- one, so such a title would sit unlisted indefinitely.

-- 1. Per-title reminder counters, mirroring the image-reminder columns.
ALTER TABLE public.magazines
  ADD COLUMN IF NOT EXISTS price_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_reminder_last_sent_at timestamptz;

-- 2. Atomically bump counters for the titles whose email actually sent.
CREATE OR REPLACE FUNCTION public.bump_price_reminders(mag_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  update public.magazines
     set price_reminder_count = price_reminder_count + 1,
         price_reminder_last_sent_at = now()
   where id = any(mag_ids);
$$;

-- Only the edge function (service role) may bump counters. Left open, any
-- anon caller could inflate the count and silently suppress a publisher's
-- reminders. bump_image_reminders shipped with the implicit PUBLIC grant, so
-- it gets the same treatment here.
REVOKE ALL ON FUNCTION public.bump_price_reminders(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_price_reminders(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.bump_image_reminders(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_image_reminders(uuid[]) TO service_role;

-- 3. Don't tell a publisher their page is live and worth sharing when it has
--    no active titles on it — which is exactly the state an unpriced title
--    leaves them in.
CREATE OR REPLACE FUNCTION public.due_profile_reminders()
 RETURNS TABLE(id uuid, email text, name text, company_name text, profile_slug text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    u.email,
    COALESCE(NULLIF(pr.full_name, ''), p.company_name, 'there') AS name,
    p.company_name,
    p.profile_slug
  FROM public.publishers p
  JOIN public.users u ON u.id = p.user_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.application_status = 'approved'
    AND p.profile_reminder_sent_at IS NULL
    AND p.verified_at IS NOT NULL
    AND p.verified_at <= now() - interval '7 days'
    AND u.email IS NOT NULL
    AND u.email <> ''
    AND u.email NOT ILIKE '%@neesh.art'
    AND EXISTS (
      SELECT 1 FROM public.magazines m
      WHERE m.publisher_id = p.id AND m.is_active
    );
$function$;

-- 4. Weekly schedule. Thursday, so it doesn't land the same morning as the
--    Monday cover-image reminder.
SELECT cron.unschedule('send-price-reminders-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-price-reminders-weekly');

SELECT cron.schedule(
  'send-price-reminders-weekly',
  '0 15 * * 4',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-price-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- 5. Grandfather the dormant back catalogue. Every unpriced title predating the
--    priced-before-listing rule is seed or bulk-import data (one publisher alone
--    has eight placeholder rows from February), not something a publisher is
--    waiting to list. Starting them at the cap means the job only chases titles
--    created from here on. Clear the count on a specific title to chase it.
UPDATE public.magazines
SET price_reminder_count = 4
WHERE wholesale_price IS NULL
  AND created_at < '2026-08-01';
