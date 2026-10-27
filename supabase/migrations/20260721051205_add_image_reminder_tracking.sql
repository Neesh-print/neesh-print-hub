alter table public.magazines
  add column if not exists image_reminder_count integer not null default 0,
  add column if not exists image_reminder_last_sent_at timestamptz;

comment on column public.magazines.image_reminder_count is
  'Count of cover-image reminder emails sent to the publisher for this title. Capped at 4; the title stops being selected once cover_image_url is set.';

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
$$;;
