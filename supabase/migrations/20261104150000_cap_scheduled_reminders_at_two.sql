-- Cap every scheduled reminder email at 2 sends per recipient (Gem, Nov 4 2026).
-- Price and cover reminders cap in code (MAX_REMINDERS = 2). This adds the
-- missing counter for ships-from reminders and a cap for invoice reminders.

-- Ships-from reminders: counter, last-sent time, and a per-publisher opt-out.
alter table public.publishers
  add column if not exists shipping_reminder_count integer not null default 0,
  add column if not exists shipping_reminder_last_sent_at timestamptz,
  add column if not exists shipping_reminders_opted_out boolean not null default false;

-- Backfill from Resend: publishers who got both the Oct 30 and Nov 3 sends
-- have used their 2 reminders.
update public.publishers p
   set shipping_reminder_count = 2,
       shipping_reminder_last_sent_at = '2026-11-03 15:00:00+00'
  from public.users u
 where u.id = p.user_id
   and lower(u.email) in (
    'hello@bobbety.com','aedo.magazine@archivionegroni.it','kevin.whitchurch@pitch-mag.co.uk','anja@broccolimag.com',
    'amcrysell@gmail.com','claire@eos-magazine.com','enzo.folalier@gmail.com','claire@divinghorseac.com',
    'imani@thefashiontourist.com','tom@silverbackliblishing.rocks','christopher@liftmarketing.co','jack@wearemakers.info',
    'phillip@roadsandkingdoms.com','david@waxpoetics.com','review@bostonreview.net','brandon@burnaway.org',
    'lda@family.style','bula@fijirunway.com','nc@family.style','hello@noonemag.com','penelope@petitmort.com',
    'benjamin@emergentmag.com','admin@swr.live','adamjampayne@gmail.com','kieron@13tracks.com','vladimir@carisma.media',
    'laura@geezermagazine.com','brooke@thesecondserve.com','wyrdsciencezine@gmail.com','andy@memwamagazine.com',
    'ripley@dirtymagazine.com');

-- Got only the Oct 30 send.
update public.publishers p
   set shipping_reminder_count = greatest(shipping_reminder_count, 1),
       shipping_reminder_last_sent_at = coalesce(shipping_reminder_last_sent_at, '2026-10-30 15:00:00+00')
  from public.users u
 where u.id = p.user_id
   and lower(u.email) in ('hello@perhapsmagazine.com','elly@microcosmpublishing.com','brettwarnock@gmail.com','mpaparella@thegotham.org');

-- Roads & Kingdoms replied "Stop".
update public.publishers p set shipping_reminders_opted_out = true
  from public.users u where u.id = p.user_id and lower(u.email) = 'phillip@roadsandkingdoms.com';

-- Invoice reminders: count each stamped send, cap at 2 per invoice.
alter table public.invoices add column if not exists reminder_count integer not null default 0;

create or replace function public.bump_invoice_reminder_count()
returns trigger language plpgsql as $$
begin
  if new.last_reminder_at is distinct from old.last_reminder_at and new.last_reminder_at is not null then
    new.reminder_count := coalesce(old.reminder_count, 0) + 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_bump_invoice_reminder_count on public.invoices;
create trigger trg_bump_invoice_reminder_count before update on public.invoices
  for each row execute function public.bump_invoice_reminder_count();

create or replace function public.due_invoice_reminders()
 returns table(invoice_id uuid, retailer_id uuid, email text, shop_name text, total numeric, amount_due numeric, due_at timestamp with time zone, hosted_invoice_url text, reminder_kind text)
 language sql stable security definer set search_path to 'public'
as $function$
  select i.id, i.retailer_id, u.email, r.shop_name,
         i.total, i.amount_due, i.due_at, i.hosted_invoice_url,
         case when i.due_at < now() then 'overdue' else 'due_soon' end
  from public.invoices i
  join public.users u          on u.id = i.retailer_id
  left join public.retailers r on r.user_id = i.retailer_id
  where i.status in ('open', 'overdue')
    and i.reminder_count < 2
    and (i.last_reminder_at is null or i.last_reminder_at < now() - interval '3 days')
    and i.due_at < now() + interval '3 days';
$function$;

-- Ships-from reminder job was paused by hand on Nov 4 while this landed.
-- Turn it back on once the new send-shipping-reminders is deployed:
--   select cron.alter_job(9, active := true);
