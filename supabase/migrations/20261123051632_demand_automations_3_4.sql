-- Demand-signal automations 3 and 4 (spec: Demand-signal automations).
-- Builds on demand_signal_phase0 and demand_automations_1_2.
--
-- 1. outreach_log.meta: what a requester email resolves when it is sent
--    (resolution, stockist, magazine), so sending can close the signal.
-- 2. outreach_suppressions: addresses that unsubscribed. Checked before any
--    draft is written and again before any send.
-- 3. directory_demand_signals.routed_at / route: Automation 4's record of
--    how a space request was matched (Neesh space or Nustand lead).
-- 4. demand_upsert_nustand_lead: writes a hot lead into the private Nustand
--    workspace for the service role, keeping Gem's review fields.
-- 5. Space requests are routed the moment they land (pg_net trigger), and a
--    job every hour routes anything missed, drafts requester emails and
--    closes requests with no match in 120 days.

-- 1. -------------------------------------------------------------------------
alter table public.outreach_log
  add column meta jsonb not null default '{}'::jsonb;

-- 2. -------------------------------------------------------------------------
create table public.outreach_suppressions (
  email      text primary key check (email = lower(trim(email))),
  reason     text not null default 'unsubscribed',
  source_outreach_id uuid references public.outreach_log(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.outreach_suppressions enable row level security;
revoke all on public.outreach_suppressions from anon, authenticated;
grant select on public.outreach_suppressions to authenticated;
create policy outreach_suppressions_admin_read
  on public.outreach_suppressions
  for select to authenticated
  using (public.is_admin());

-- 3. -------------------------------------------------------------------------
alter table public.directory_demand_signals
  add column routed_at timestamptz,
  add column route jsonb;

create index directory_demand_signals_unrouted_idx
  on public.directory_demand_signals(created_at)
  where requester_role = 'space' and routed_at is null and status is not null;

-- 4. -------------------------------------------------------------------------
-- p_source is a complete Nustand prospect record (see src/features/nustand/
-- model.ts prospectSchema). An existing record keeps its review, research
-- and contacts; only the demand block and the hot flag are merged in.
create or replace function public.demand_upsert_nustand_lead(p_source jsonb)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id text := p_source->>'id';
begin
  if v_id is null or length(v_id) not between 1 and 200
     or jsonb_typeof(p_source->'name') is distinct from 'string'
     or jsonb_typeof(p_source->'contacts') is distinct from 'array'
     or jsonb_typeof(p_source->'original_record') is distinct from 'object'
     or jsonb_typeof(p_source->'job') is distinct from 'object'
     or jsonb_typeof(p_source->'fit') is distinct from 'object'
     or jsonb_typeof(p_source->'do_not_contact') is distinct from 'boolean' then
    raise exception 'invalid Nustand lead';
  end if;

  insert into nustand_private.prospects (id, source)
  values (v_id, p_source)
  on conflict (id) do update
    set source = nustand_private.prospects.source
                 || jsonb_build_object(
                      'hot', true,
                      'demand', coalesce(nustand_private.prospects.source->'demand', '{}'::jsonb)
                                || coalesce(excluded.source->'demand', '{}'::jsonb)
                                || jsonb_build_object(
                                     'wants_titles',
                                     (select coalesce(jsonb_agg(distinct t.value), '[]'::jsonb)
                                        from jsonb_array_elements(
                                               coalesce(nustand_private.prospects.source->'demand'->'wants_titles', '[]'::jsonb)
                                               || coalesce(excluded.source->'demand'->'wants_titles', '[]'::jsonb)) t),
                                     'signal_ids',
                                     (select coalesce(jsonb_agg(distinct s.value), '[]'::jsonb)
                                        from jsonb_array_elements(
                                               coalesce(nustand_private.prospects.source->'demand'->'signal_ids', '[]'::jsonb)
                                               || coalesce(excluded.source->'demand'->'signal_ids', '[]'::jsonb)) s))),
        updated_at = now();
  return v_id;
end;
$$;
revoke all on function public.demand_upsert_nustand_lead(jsonb) from public, anon, authenticated;

-- 5. -------------------------------------------------------------------------
create or replace function public.directory_demand_signals_route_space()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.requester_role = 'space' and new.status is not null then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/process-demand-loop',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
      ),
      body := jsonb_build_object('only', 'route', 'signalId', new.id),
      timeout_milliseconds := 60000
    );
  end if;
  return new;
end;
$$;
revoke all on function public.directory_demand_signals_route_space() from public, anon, authenticated;

create trigger directory_demand_signals_route_space
  after insert on public.directory_demand_signals
  for each row execute function public.directory_demand_signals_route_space();

select cron.schedule(
  'process-demand-loop-hourly',
  '20 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/process-demand-loop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  $cron$
);
