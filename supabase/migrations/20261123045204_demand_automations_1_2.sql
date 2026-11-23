-- Demand-signal automations 1 and 2 (spec: Demand-signal automations).
-- Builds on 20261123033742_demand_signal_phase0.sql.
--
-- 1. Admins can read the suggestion queue and outreach_log from the app.
--    Every write still goes through the demand-review edge function, which
--    runs as the service role.
-- 2. directory_approve_stockist_suggestion: one transaction that creates the
--    store if it is missing, lists it as a current stockist for the title,
--    and marks the suggestion approved.
-- 3. Cron: verify new suggestions every 15 minutes (only when there are
--    any), and draft publisher emails daily at 10am ET.

-- 1. Admin read access -------------------------------------------------------

create policy directory_stockist_suggestions_admin_read
  on public.directory_stockist_suggestions
  for select to authenticated
  using (public.is_admin());

grant select on public.outreach_log to authenticated;
create policy outreach_log_admin_read
  on public.outreach_log
  for select to authenticated
  using (public.is_admin());

-- 2. Approve a suggestion ------------------------------------------------------

create or replace function public.directory_approve_stockist_suggestion(
  p_id uuid,
  p_reviewer uuid
) returns jsonb
language plpgsql
security definer
-- public, not '': the directory_stores slug trigger calls directory_slugify unqualified.
set search_path to public
as $$
declare
  s        public.directory_stockist_suggestions%rowtype;
  t        public.directory_titles%rowtype;
  place    jsonb;
  v_store  uuid;
  v_stock  uuid;
  v_name   text;
  v_city   text;
  v_country text;
  v_source text;
begin
  select * into s from public.directory_stockist_suggestions where id = p_id for update;
  if not found then
    raise exception 'suggestion not found' using errcode = 'no_data_found';
  end if;
  if s.status not in ('new', 'verifying', 'needs_review') then
    raise exception 'suggestion is already %', s.status using errcode = 'check_violation';
  end if;

  select * into t from public.directory_titles where id = s.title_id;
  place := coalesce(s.evidence->'place', '{}'::jsonb);
  v_store := s.store_id;

  if v_store is null then
    v_name := coalesce(nullif(btrim(place->>'name'), ''), btrim(s.shop_name));
    v_city := coalesce(nullif(btrim(s.city), ''), nullif(btrim(place->>'city'), ''));
    v_country := upper(nullif(btrim(place->>'country'), ''));
    if v_country is null or length(v_country) <> 2 then
      raise exception 'no country for this shop: match it to a store first'
        using errcode = 'check_violation';
    end if;

    insert into public.directory_stores (name, city, country, website, address, match_key)
    values (
      v_name,
      v_city,
      v_country,
      nullif(place->>'website', ''),
      nullif(place->>'address', ''),
      regexp_replace(lower(extensions.unaccent(v_name)), '[^a-z0-9]+', '', 'g')
    )
    on conflict (country, (coalesce(city, '')), match_key)
      do update set updated_at = now()
    returning id into v_store;
  end if;

  v_source := coalesce(
    nullif(s.evidence->'title_hit'->>'url', ''),
    nullif(place->>'website', ''),
    nullif(place->>'maps_url', ''),
    'https://neesh.art/titles/' || t.slug
  );

  insert into public.directory_stockists (publisher_id, store_id, title_id, listed_name, source_url, collected_at, is_current)
  values (t.publisher_id, v_store, t.id, s.shop_name, v_source, current_date, true)
  on conflict (publisher_id, store_id, (coalesce(title_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    do update set is_current = true, collected_at = current_date, source_url = excluded.source_url
  returning id into v_stock;

  update public.directory_stockist_suggestions
     set status = 'approved',
         store_id = v_store,
         stockist_id = v_stock,
         reviewed_at = now(),
         reviewed_by = p_reviewer,
         reject_reason = null
   where id = p_id;

  return jsonb_build_object(
    'store_id', v_store,
    'stockist_id', v_stock,
    'title_slug', t.slug,
    'store_slug', (select slug from public.directory_stores where id = v_store),
    'city_slug', (select c.slug from public.directory_stores st
                    join public.directory_cities c on c.name = st.city and c.country = st.country
                   where st.id = v_store)
  );
end;
$$;

revoke all on function public.directory_approve_stockist_suggestion(uuid, uuid) from public, anon, authenticated;

-- 3. Cron ------------------------------------------------------------------------

select cron.schedule(
  'verify-stockist-suggestions',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/verify-stockist-suggestions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.directory_stockist_suggestions where status = 'new')
  $cron$
);

-- 10am ET is 15:00 UTC in winter, 14:00 in summer; this keeps EST like the
-- other reminder jobs.
select cron.schedule(
  'draft-publisher-outreach-daily',
  '0 15 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/draft-publisher-outreach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $cron$
);
