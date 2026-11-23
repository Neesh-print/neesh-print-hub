-- Gem, Nov 23 2026: Automation 3 (requester emails D-G) only for requests made from now on.
-- Drops any reader/space draft whose linked request, suggestion or stock notification predates the cutoff.
--
-- Applied directly to production on Nov 23, 2026 and copied here so the repo
-- matches it. The cutoff was moved to 05:50 UTC by the next migration.
create or replace function public.outreach_requester_cutoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff constant timestamptz := '2026-11-23 16:00:00+00';
begin
  if new.recipient_type not in ('reader', 'space') then
    return new;
  end if;
  if exists (select 1 from directory_demand_signals s where s.id = any(coalesce(new.demand_signal_ids, '{}')) and s.created_at < cutoff)
     or exists (select 1 from directory_stockist_suggestions g where g.id = any(coalesce(new.suggestion_ids, '{}')) and g.created_at < cutoff)
     or exists (select 1 from stock_notifications n where n.id = any(coalesce(new.stock_notification_ids, '{}')) and n.created_at < cutoff)
  then
    return null; -- silently drop: no email for requests made before the cutoff
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_requester_cutoff on public.outreach_log;
create trigger outreach_requester_cutoff
before insert on public.outreach_log
for each row execute function public.outreach_requester_cutoff();

comment on function public.outreach_requester_cutoff() is
  'Requester emails (templates D-G) only for requests made on or after 2026-11-23 16:00 UTC. Publisher emails (A-C) are unaffected.';
