-- Demand-signal automations, Phase 0: statuses, resolution links, outreach log, demand view.
-- Spec: "Spec: Demand-signal automations" (Nov 22, 2026).
--
-- Differences from the spec, all deliberate:
--   * Status columns are text + CHECK (matches the existing suggestions table) rather than enums.
--   * requester_role / requester_email / postcode are GENERATED from payload, so the public
--     site keeps writing payload only and the columns can never drift.
--   * demand signal status is NULL for view/click/order rows; a trigger sets 'open' on insert
--     for stock_request and want_near.
--   * outreach_log splits signal ids by type (demand signal ids are bigint, suggestion ids uuid),
--     stores the Resend message id instead of a Gmail draft id, and carries publisher_id so the
--     per-publisher cap is a simple count.
--   * Suggestions gain ip_hash for the spam rule; the public site needs to start writing it.

-- ---------------------------------------------------------------------------
-- directory_stockist_suggestions
-- ---------------------------------------------------------------------------
alter table public.directory_stockist_suggestions
  drop constraint if exists directory_stockist_suggestions_status_check;

update public.directory_stockist_suggestions
   set status = case status
                  when 'added'    then 'approved'
                  when 'declined' then 'rejected'
                  else 'needs_review'
                end;

alter table public.directory_stockist_suggestions
  alter column status set default 'new',
  add constraint directory_stockist_suggestions_status_check
    check (status in ('new', 'verifying', 'needs_review', 'approved', 'rejected', 'duplicate')),
  add column confidence text
    check (confidence in ('confirmed', 'likely', 'unverified')),
  add column evidence jsonb not null default '{}'::jsonb,
  add column store_id uuid references public.directory_stores(id) on delete set null,
  add column stockist_id uuid references public.directory_stockists(id) on delete set null,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reject_reason text
    check (reject_reason in ('not_stocked', 'closed', 'spam', 'other')),
  add column requester_notified_at timestamptz,
  add column ip_hash text;

create index directory_stockist_suggestions_title_idx
  on public.directory_stockist_suggestions(title_id, created_at);
create index directory_stockist_suggestions_ip_idx
  on public.directory_stockist_suggestions(ip_hash, created_at)
  where ip_hash is not null;

-- ---------------------------------------------------------------------------
-- directory_demand_signals (status applies to stock_request and want_near only)
-- ---------------------------------------------------------------------------
alter table public.directory_demand_signals
  add column status text
    check (status in ('open', 'publisher_contacted', 'resolved', 'closed_no_action')),
  add column resolution text
    check (resolution in ('now_selling', 'stockist_added', 'back_in_stock',
                          'publisher_declined', 'distributor_only')),
  add column resolved_at timestamptz,
  add column resolved_by_stockist_id uuid references public.directory_stockists(id) on delete set null,
  add column resolved_by_magazine_id uuid references public.magazines(id) on delete set null,
  add column retailer_id uuid references public.retailers(id) on delete set null,
  add column requester_notified_at timestamptz,
  add column requester_role  text generated always as (payload->>'role') stored,
  add column requester_email text generated always as (lower(nullif(trim(payload->>'email'), ''))) stored,
  add column postcode        text generated always as (nullif(trim(payload->>'postcode'), '')) stored;

update public.directory_demand_signals
   set status = case
                  when title_id in ('1aa4127a-fa33-41b3-8e7e-0524213b1d32',  -- Heavy Traffic
                                    '53f57228-4842-4321-b0cc-58199da35db2')  -- Linseed
                    then 'publisher_contacted'
                  else 'open'
                end
 where signal_type in ('stock_request', 'want_near');

alter table public.directory_demand_signals
  add constraint directory_demand_signals_status_scope check (
    (signal_type in ('stock_request', 'want_near')) = (status is not null)
  ),
  add constraint directory_demand_signals_resolution_needs_resolved check (
    resolution is null or status in ('resolved', 'closed_no_action')
  );

create or replace function public.directory_demand_signals_default_status()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.signal_type in ('stock_request', 'want_near') and new.status is null then
    new.status := 'open';
  end if;
  return new;
end;
$$;

create trigger directory_demand_signals_default_status
  before insert on public.directory_demand_signals
  for each row execute function public.directory_demand_signals_default_status();

create index directory_demand_signals_request_status_idx
  on public.directory_demand_signals(title_id, status, created_at)
  where status is not null;
create index directory_demand_signals_requester_email_idx
  on public.directory_demand_signals(requester_email)
  where requester_email is not null;

-- ---------------------------------------------------------------------------
-- directory_titles: outreach opt-outs
-- ---------------------------------------------------------------------------
alter table public.directory_titles
  add column distributor_exclusive boolean not null default false,
  add column do_not_contact boolean not null default false;

-- ---------------------------------------------------------------------------
-- outreach_log: one row per automated or drafted email
-- ---------------------------------------------------------------------------
create table public.outreach_log (
  id                    uuid primary key default gen_random_uuid(),
  recipient_email       text not null check (recipient_email = lower(trim(recipient_email))),
  recipient_type        text not null check (recipient_type in ('publisher', 'reader', 'space')),
  template              text not null check (template in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  title_id              uuid references public.directory_titles(id) on delete set null,
  publisher_id          uuid references public.directory_publishers(id) on delete set null,
  demand_signal_ids     bigint[] not null default '{}',
  suggestion_ids        uuid[]   not null default '{}',
  stock_notification_ids uuid[]  not null default '{}',
  subject               text,
  body                  text,
  status                text not null default 'draft'
                          check (status in ('draft', 'approved', 'sent', 'skipped')),
  skip_reason           text,
  resend_message_id     text,
  approved_by           uuid references auth.users(id) on delete set null,
  approved_at           timestamptz,
  sent_at               timestamptz,
  created_at            timestamptz not null default now(),
  check ((status = 'sent') = (sent_at is not null))
);

-- No duplicate live email of the same template about the same title to the same person.
create unique index outreach_log_no_duplicate_idx
  on public.outreach_log(recipient_email, template, coalesce(title_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('draft', 'approved', 'sent');
create index outreach_log_recipient_idx on public.outreach_log(recipient_email, status);
create index outreach_log_publisher_idx on public.outreach_log(publisher_id, created_at)
  where publisher_id is not null;
create index outreach_log_title_idx on public.outreach_log(title_id, created_at);

alter table public.outreach_log enable row level security;

-- Guardrail: two automated emails per recipient, ever, across all templates.
create or replace function public.outreach_log_enforce_cap()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    perform pg_advisory_xact_lock(hashtext('outreach_log:' || new.recipient_email));
    if (select count(*) from public.outreach_log
         where recipient_email = new.recipient_email
           and status = 'sent'
           and id <> new.id) >= 2 then
      raise exception 'outreach cap reached for recipient (2 automated emails)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger outreach_log_enforce_cap
  before insert or update of status on public.outreach_log
  for each row execute function public.outreach_log_enforce_cap();

-- ---------------------------------------------------------------------------
-- v_title_demand: per-title demand, state and outreach history (internal only)
-- ---------------------------------------------------------------------------
create view public.v_title_demand
with (security_invoker = true) as
with req as (
  select s.title_id,
         count(*) filter (where s.status = 'open' and s.requester_role = 'reader'
                            and s.created_at >= now() - interval '30 days') as open_reader_30d,
         count(*) filter (where s.status = 'open' and s.requester_role = 'space'
                            and s.created_at >= now() - interval '30 days') as open_space_30d,
         count(*) filter (where s.requester_role = 'reader'
                            and s.created_at >= now() - interval '30 days') as reader_30d,
         count(*) filter (where s.requester_role = 'space'
                            and s.created_at >= now() - interval '30 days') as space_30d,
         count(*) filter (where s.requester_role = 'reader'
                            and s.created_at >= now() - interval '90 days') as reader_90d,
         count(*) filter (where s.requester_role = 'space'
                            and s.created_at >= now() - interval '90 days') as space_90d,
         count(*) filter (where s.status = 'open') as open_total,
         array_agg(distinct s.postcode) filter (where s.postcode is not null
                            and s.created_at >= now() - interval '90 days') as postcodes_90d,
         max(s.created_at) as last_request_at
    from public.directory_demand_signals s
   where s.signal_type in ('stock_request', 'want_near')
   group by s.title_id
),
outreach as (
  select o.title_id,
         max(o.sent_at) as last_outreach_at
    from public.outreach_log o
   where o.status = 'sent'
   group by o.title_id
),
pub_outreach as (
  select o.publisher_id,
         count(*) filter (where o.status in ('draft', 'approved', 'sent')) as publisher_outreach_count,
         max(o.sent_at) as publisher_last_emailed_at
    from public.outreach_log o
   where o.recipient_type = 'publisher' and o.publisher_id is not null
   group by o.publisher_id
)
select t.id as title_id,
       t.name as title_name,
       t.slug as title_slug,
       t.publisher_id,
       case
         when t.available_on_neesh and coalesce(m.inventory_count, 0) <= 0 then 'out_of_stock'
         when t.available_on_neesh then 'selling'
         when p.claimed then 'claimed'
         else 'unclaimed'
       end as title_state,
       t.neesh_magazine_id,
       m.inventory_count,
       coalesce(p.claimed_email, p.contact_email) as publisher_email,
       t.do_not_contact,
       t.distributor_exclusive,
       req.open_reader_30d,
       req.open_space_30d,
       req.reader_30d,
       req.space_30d,
       req.reader_90d,
       req.space_90d,
       req.open_total,
       req.postcodes_90d,
       req.last_request_at,
       outreach.last_outreach_at,
       coalesce(po.publisher_outreach_count, 0) as publisher_outreach_count,
       po.publisher_last_emailed_at
  from req
  join public.directory_titles t on t.id = req.title_id
  left join public.directory_publishers p on p.id = t.publisher_id
  left join public.magazines m on m.id = t.neesh_magazine_id
  left join outreach on outreach.title_id = t.id
  left join pub_outreach po on po.publisher_id = t.publisher_id;

revoke all on public.v_title_demand from anon, authenticated;
revoke all on public.outreach_log from anon, authenticated;
