-- Funnel events. Deliberately carries NO visitor identifier, no IP, no session:
-- aggregate counts only, so nothing here can ever be joined back to a submission.
create table if not exists public.odditt_events (
  id bigserial primary key,
  name text not null,
  slug text,
  template text,
  created_at timestamptz not null default now()
);
create index if not exists odditt_events_name_time on public.odditt_events (name, created_at desc);
create index if not exists odditt_events_slug on public.odditt_events (slug) where slug is not null;
alter table public.odditt_events enable row level security;

create or replace function public.odditt_track(p_name text, p_slug text, p_template text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_allowed text[] := array[
  'r_view','r_start','r_filed','loop_click',
  'new_view','new_created','results_view','me_view','signin_requested'
];
begin
  if p_name is null or not (p_name = any(v_allowed)) then
    return jsonb_build_object('error','bad_event');
  end if;
  insert into odditt_events(name, slug, template)
  values (p_name, left(nullif(p_slug,''), 40), left(nullif(p_template,''), 20));
  return jsonb_build_object('ok', true);
end $$;

-- Aggregate funnel for the dashboard. No per-person data leaves the DB.
create or replace function public.odditt_funnel(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_since timestamptz := now() - (greatest(coalesce(p_days,30),1) || ' days')::interval;
        v_events jsonb; v_by_template jsonb; v_requests jsonb; v_daily jsonb;
begin
  select coalesce(jsonb_object_agg(name, n), '{}'::jsonb) into v_events
    from (select name, count(*) n from odditt_events where created_at > v_since group by name) e;

  select coalesce(jsonb_agg(jsonb_build_object(
      'template', template, 'views', views, 'starts', starts, 'filed', filed
    ) order by views desc), '[]'::jsonb) into v_by_template
    from (
      select template,
        count(*) filter (where name='r_view')  as views,
        count(*) filter (where name='r_start') as starts,
        count(*) filter (where name='r_filed') as filed
      from odditt_events
      where created_at > v_since and template is not null
      group by template
    ) t;

  select jsonb_build_object(
      'created', count(*),
      'with_responses', count(*) filter (where sub_count > 0),
      'dead', count(*) filter (where sub_count = 0),
      'median_responses', coalesce(percentile_cont(0.5) within group (order by sub_count), 0)
    ) into v_requests
    from (
      select r.id, (select count(*) from odditt_submissions s where s.request_id = r.id) sub_count
      from odditt_requests r where r.created_at > v_since
    ) q;

  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'created', c, 'filed', f) order by d desc), '[]'::jsonb)
    into v_daily
    from (
      select date_trunc('day', x.ts)::date d,
             count(*) filter (where x.kind='created') c,
             count(*) filter (where x.kind='filed') f
      from (
        select created_at ts, 'created' kind from odditt_requests where created_at > v_since
        union all
        select created_at ts, 'filed' kind from odditt_submissions where created_at > v_since
      ) x group by 1
    ) dd;

  return jsonb_build_object(
    'days', p_days, 'events', v_events, 'by_template', v_by_template,
    'requests', v_requests, 'daily', v_daily
  );
end $$;;
