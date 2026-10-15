-- Nustand paid place lookups: database-enforced spend cap.
-- One unit per provider call. Limits keep both providers inside their free tiers:
-- at most 600 calls a day and 2,000 a calendar month (UTC), across providers.
create table nustand_private.provider_budget(
  day date primary key,
  calls integer not null default 0 check (calls between 0 and 600)
);
alter table nustand_private.provider_budget enable row level security;
revoke all on nustand_private.provider_budget from public, anon, authenticated;

create function nustand_private.worker_provider_budget(calls integer) returns boolean
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

create function public.nustand_worker_provider_budget(calls integer) returns boolean
language sql security invoker set search_path = pg_catalog as $$select nustand_private.worker_provider_budget(calls)$$;

revoke all on function nustand_private.worker_provider_budget(integer), public.nustand_worker_provider_budget(integer) from public, anon, authenticated;
grant execute on function nustand_private.worker_provider_budget(integer), public.nustand_worker_provider_budget(integer) to service_role;
