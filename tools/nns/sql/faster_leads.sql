-- Nustand: deeper lead searches.
-- A search can now use up to 10 Google lookups (5 queries x 2 pages), so one
-- reservation may take up to 12. The monthly ceiling rises from 1,000 (Google's
-- free allowance) to 2,000, which caps overage at about $35 a month.
create or replace function nustand_private.worker_provider_budget(calls integer) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare today date := (now() at time zone 'UTC')::date; used_month integer; used integer;
begin
  if calls is null or calls not between 1 and 12 then raise exception 'Invalid provider budget request'; end if;
  perform pg_advisory_xact_lock(723407103);
  select coalesce(sum(b.calls), 0) into used_month from nustand_private.provider_budget b
    where b.day >= date_trunc('month', today)::date;
  if used_month + calls > 2000 then return false; end if;
  insert into nustand_private.provider_budget(day, calls) values (today, calls)
    on conflict (day) do update set calls = provider_budget.calls + excluded.calls
    where provider_budget.calls + excluded.calls <= 600
    returning provider_budget.calls into used;
  return used is not null;
end $$;
