-- Gem, Nov 23 2026: requester-email cutoff moved to 05:50 UTC, and the
-- shop-suggestion check (verify-stockist-suggestions) moved from every 15
-- minutes to once a day at 14:45 UTC.
--
-- Applied directly to production on Nov 23, 2026 and copied here so the repo
-- matches it. Production ran cron.alter_job(12, ...); job 12 is
-- verify-stockist-suggestions there, so this copy looks the job up by name to
-- work on a fresh database too.
create or replace function public.outreach_requester_cutoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff constant timestamptz := '2026-11-23 05:50:00+00';
begin
  if new.recipient_type not in ('reader', 'space') then
    return new;
  end if;
  if exists (select 1 from directory_demand_signals s where s.id = any(coalesce(new.demand_signal_ids, '{}')) and s.created_at < cutoff)
     or exists (select 1 from directory_stockist_suggestions g where g.id = any(coalesce(new.suggestion_ids, '{}')) and g.created_at < cutoff)
     or exists (select 1 from stock_notifications n where n.id = any(coalesce(new.stock_notification_ids, '{}')) and n.created_at < cutoff)
  then
    return null;
  end if;
  return new;
end;
$$;
comment on function public.outreach_requester_cutoff() is
  'Requester emails (templates D-G) only for requests made on or after 2026-11-23 05:50 UTC. Publisher emails (A-C) are unaffected.';
select cron.alter_job(
  (select jobid from cron.job where jobname = 'verify-stockist-suggestions'),
  schedule := '45 14 * * *'
);
