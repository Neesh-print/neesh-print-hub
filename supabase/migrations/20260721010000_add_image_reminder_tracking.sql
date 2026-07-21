-- Track "upload a cover image" reminder emails per magazine.
--
-- A publisher is reminded weekly to add a cover image to a title, for at most
-- 4 weeks or until the image is uploaded (whichever comes first). We cap on
-- image_reminder_count and stop naturally once cover_image_url is set, since an
-- imageless magazine is the only thing the reminder job selects.
alter table public.magazines
  add column if not exists image_reminder_count integer not null default 0,
  add column if not exists image_reminder_last_sent_at timestamptz;

comment on column public.magazines.image_reminder_count is
  'Count of cover-image reminder emails sent to the publisher for this title. Capped at 4; the title stops being selected once cover_image_url is set.';

-- Atomically bump the counter for the titles that were included in a reminder
-- run. SECURITY DEFINER so the reminder edge function (service role) can call it.
create or replace function public.bump_image_reminders(mag_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.magazines
     set image_reminder_count = image_reminder_count + 1,
         image_reminder_last_sent_at = now()
   where id = any(mag_ids);
$$;
