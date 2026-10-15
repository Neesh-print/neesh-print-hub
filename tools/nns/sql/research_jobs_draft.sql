-- Review before production application. Worker starts disabled.
begin;
alter table nustand_private.prospects add column research jsonb not null default '{}';
create table nustand_private.research_settings(singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into nustand_private.research_settings default values;
create table nustand_private.research_jobs (
 id uuid primary key default gen_random_uuid(),
 prospect_id text references nustand_private.prospects(id),
 kind text not null check(kind in ('research','discovery')),
 input jsonb not null default '{}', result jsonb,
 status text not null default 'queued' check(status in ('queued','running','completed','partial','failed','blocked','needs_website','cancelled')),
 created_at timestamptz not null default now(), finished_at timestamptz,
 lease uuid, lease_until timestamptz, next_eligible_at timestamptz,
 error text, requests integer not null default 0, pages integer not null default 0
);
create unique index nustand_one_active_job on nustand_private.research_jobs(prospect_id) where kind='research' and status in ('queued','running');
create index nustand_job_queue on nustand_private.research_jobs(created_at) where status='queued';
create table nustand_private.place_budget(day date primary key, requests integer not null default 0 check(requests between 0 and 50));
alter table nustand_private.research_settings enable row level security;
alter table nustand_private.research_jobs enable row level security;
alter table nustand_private.place_budget enable row level security;
revoke all on all tables in schema nustand_private from public,anon,authenticated;

create function nustand_private.effective_source(raw jsonb, researched jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog as $$
declare item jsonb; prior jsonb; contacts jsonb := '{}'; combined jsonb;
begin
 for item in select value from jsonb_array_elements(coalesce(raw->'contacts','[]')) loop
   contacts := jsonb_set(contacts,array[item->>'id'],item);
 end loop;
 for item in select value from jsonb_array_elements(coalesce(researched->'contacts','[]')) loop
   prior := contacts->(item->>'id');
   if prior is not null then
     select coalesce(jsonb_agg(distinct e),'[]') into combined from jsonb_array_elements(coalesce(prior->'evidence','[]') || coalesce(item->'evidence','[]')) e;
     item := prior || jsonb_build_object('evidence',combined);
   end if;
   contacts := jsonb_set(contacts,array[item->>'id'],item);
 end loop;
 select coalesce(jsonb_agg(value order by key),'[]') into combined from jsonb_each(contacts);
 return raw || (researched - 'id' - 'name' - 'original_record' - 'do_not_contact' - 'contacts') || jsonb_build_object('contacts',combined);
end $$;
revoke all on function nustand_private.effective_source(jsonb,jsonb) from public,anon,authenticated;

create view nustand_private.prospect_rows with (security_invoker=true) as
select p.id, nustand_private.effective_source(p.source,p.research) ||
 case when j.status is not null then jsonb_build_object('job',coalesce(p.research->'job',p.source->'job') || jsonb_build_object('status',j.status)) else '{}' end as source,
 p.review,p.version
from nustand_private.prospects p left join lateral (select status from nustand_private.research_jobs where prospect_id=p.id order by created_at desc limit 1) j on true;
revoke all on nustand_private.prospect_rows from public,anon,authenticated;

create or replace function nustand_private.nustand_list() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform nustand_private.require_owner();
 select coalesce(jsonb_agg(jsonb_build_object('source',source,'review',review,'version',version) order by source->>'name',id),'[]') into result from nustand_private.prospect_rows;
 return result;
end $$;

create function nustand_private.research_queue(prospect_ids text[]) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare p record; added integer := 0; inserted integer;
begin
 perform nustand_private.require_owner();
 if not coalesce((select enabled from nustand_private.research_settings),false) then raise exception 'Research worker is not enabled yet'; end if;
 if prospect_ids is null or cardinality(prospect_ids) not between 1 and 500 then raise exception 'Select 1–500 spaces'; end if;
 for p in select * from nustand_private.prospect_rows where id=any(prospect_ids) loop
   if p.source->>'do_not_contact'='true' or p.review->>'do_not_contact'='true' or p.source->'original_record'->>'do_not_contact'='true' then continue; end if;
   if exists(select 1 from nustand_private.research_jobs where prospect_id=p.id and next_eligible_at>now()) then continue; end if;
   insert into nustand_private.research_jobs(prospect_id,kind) values(p.id,'research') on conflict do nothing;
   get diagnostics inserted=row_count; added:=added+inserted;
 end loop;
 return added;
end $$;

create function nustand_private.discovery_queue(area text, segment text, neighborhood text) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare identifier uuid;
begin
 perform nustand_private.require_owner();
 if not coalesce((select enabled from nustand_private.research_settings),false) then raise exception 'Research worker is not enabled yet'; end if;
 if area is null or segment is null or area not in ('New York','Manhattan','Brooklyn','Queens','Bronx','Staten Island') or segment not in ('Wait','Presence','Dwell','Taste','Catalog') or length(neighborhood)>100 or neighborhood is null then raise exception 'Invalid discovery filters'; end if;
 perform pg_advisory_xact_lock(723407102);
 select id into identifier from nustand_private.research_jobs where kind='discovery' and input=jsonb_build_object('area',area,'segment',segment,'neighborhood',neighborhood) and created_at>now()-interval '1 day' and status in ('queued','running','completed') order by created_at desc limit 1;
 if identifier is not null then return identifier; end if;
 if (select count(*) from nustand_private.research_jobs where kind='discovery' and created_at>now()-interval '1 day')>=10 then raise exception 'Daily discovery limit reached; try tomorrow'; end if;
 insert into nustand_private.research_jobs(kind,input) values('discovery',jsonb_build_object('area',area,'segment',segment,'neighborhood',neighborhood)) returning id into identifier;
 return identifier;
end $$;

create function nustand_private.research_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform nustand_private.require_owner();
 select coalesce(jsonb_agg(to_jsonb(j)-'lease'-'lease_until'),'[]') into result from (select id,prospect_id,kind,input,status,created_at,finished_at,error,requests,pages,case when kind='discovery' then result else null end result from nustand_private.research_jobs order by created_at desc limit 600) j;
 return jsonb_build_object('enabled',coalesce((select enabled from nustand_private.research_settings),false),'jobs',result);
end $$;

create function nustand_private.set_website(prospect_id text, website text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform nustand_private.require_owner();
 if website is null or length(website)>2000 or website !~ '^https?://[^/@[:space:]]+([/:?].*)?$' then raise exception 'Use a public HTTP or HTTPS website URL'; end if;
 perform 1 from nustand_private.research_jobs where research_jobs.prospect_id=set_website.prospect_id order by id for update;
 perform 1 from nustand_private.prospects where id=prospect_id for update;
 if not found then raise exception 'Space not found'; end if;
 update nustand_private.research_jobs set status='cancelled',finished_at=now() where research_jobs.prospect_id=set_website.prospect_id and status in ('queued','running');
 update nustand_private.research_jobs set next_eligible_at=null where research_jobs.prospect_id=set_website.prospect_id;
 update nustand_private.prospects set research=research || jsonb_build_object('website',website,'website_identity_review',false,'website_source','owner_supplied'),version=version+1,updated_at=now() where id=prospect_id;
end $$;

-- Worker operations are callable only by the broker's server-side service role.
create function nustand_private.worker_claim() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare j record; payload jsonb:='[]'; token uuid; effective jsonb;
begin
 if not coalesce((select enabled from nustand_private.research_settings),false) then return '[]'; end if;
 update nustand_private.research_jobs set status='failed',error='Worker timed out; review before retrying',finished_at=now(),next_eligible_at=now()+interval '1 day' where status='running' and lease_until<now();
 for j in select * from nustand_private.research_jobs where status='queued' order by case when kind='discovery' then 0 else 1 end,created_at,id limit 10 for update skip locked loop
   if j.kind='research' then
     select source into effective from nustand_private.prospect_rows where id=j.prospect_id;
     if effective->>'do_not_contact'='true' or exists(select 1 from nustand_private.prospects where id=j.prospect_id and review->>'do_not_contact'='true') then
       update nustand_private.research_jobs set status='cancelled',finished_at=now() where id=j.id; continue;
     end if;
     -- Send only research inputs. Internal notes, review decisions and history
     -- stay in the database rather than being delivered to the runner.
     effective:=jsonb_build_object('id',effective->'id','name',effective->'name','city',effective->'city','website',effective->'website','website_source',effective->'website_source','website_identity_review',effective->'website_identity_review','discovery',effective->'discovery','fit',jsonb_build_object('segment',effective->'fit'->'segment'),'original_record',coalesce((select jsonb_object_agg(key,value) from jsonb_each(effective->'original_record') where key in ('country','email','phone','instagram_handle','instagram_url','additional_contacts','business_type','category','manual_overrides','segment','quadrant','motion','budget_type','fit_score')),'{}'));
     select effective || jsonb_build_object('website_lookup_sources',coalesce((select jsonb_agg(to_jsonb(ref)) from (
       select distinct s.source_url from public.directory_stockists s join public.directory_publishers pub on pub.id=s.publisher_id
       where s.is_current and pub.eligible and not pub.removed and s.source_url is not null and s.store_id=(
         select min(d.id::text)::uuid from public.directory_stores d where lower(trim(d.name))=lower(trim(effective->>'name')) and lower(trim(d.city)) in ('new york','new york city','nyc')
         having count(*)=1
       ) order by s.source_url limit 2
     ) ref),'[]')) into effective;
   else effective:=null; end if;
   token:=gen_random_uuid();
   update nustand_private.research_jobs set status='running',lease=token,lease_until=now()+interval '20 minutes' where id=j.id;
   payload:=payload || jsonb_build_array(jsonb_build_object('id',j.id,'lease',token,'kind',j.kind,'input',j.input,'source',effective));
 end loop;
 return payload;
end $$;

create function nustand_private.worker_place_budget() returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare used integer;
begin
 insert into nustand_private.place_budget(day,requests) values((now() at time zone 'UTC')::date,1)
 on conflict(day) do update set requests=place_budget.requests+1 where place_budget.requests<50 returning requests into used;
 return used is not null;
end $$;

create function nustand_private.worker_finish(job_id uuid, lease_id uuid, payload jsonb) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare j nustand_private.research_jobs%rowtype; p nustand_private.prospects%rowtype; job_state text; c jsonb; merged jsonb;
begin
 select * into j from nustand_private.research_jobs where id=job_id for update;
 if not found or j.status<>'running' or lease_id is null or j.lease is distinct from lease_id or j.lease_until is null or j.lease_until<now() then raise exception 'Job lease expired or cancelled'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>500000 then raise exception 'Invalid research payload'; end if;
 job_state:=payload->>'status';
 if job_state is null or job_state not in ('completed','partial','failed','blocked','needs_website') then raise exception 'Invalid research status'; end if;
 if j.kind='research' then
   select * into p from nustand_private.prospects where id=j.prospect_id for update;
   if p.source->>'do_not_contact'='true' or p.review->>'do_not_contact'='true' then
     update nustand_private.research_jobs set status='cancelled',finished_at=now() where id=j.id; return;
   end if;
   if jsonb_typeof(payload->'contacts') is distinct from 'array' or jsonb_array_length(payload->'contacts')>100 or jsonb_typeof(payload->'fit') is distinct from 'object' or not(payload->'fit' ? 'score') or jsonb_typeof(payload->'fit'->'score') not in ('number','null') or jsonb_typeof(payload->'job') is distinct from 'object' or payload->'job'->>'status' is distinct from job_state then raise exception 'Invalid research evidence'; end if;
   for c in select value from jsonb_array_elements(payload->'contacts') loop
     if jsonb_typeof(c->'id') is distinct from 'string' or length(c->>'id') not between 1 and 200 or coalesce(c->>'kind','') not in ('email','phone','instagram') or jsonb_typeof(c->'value') is distinct from 'string' or length(c->>'value') not between 1 and 500 or jsonb_typeof(c->'quality_status') is distinct from 'string' or jsonb_typeof(c->'review_reasons') is distinct from 'array' or jsonb_typeof(c->'evidence') is distinct from 'array' then raise exception 'Invalid researched contact'; end if;
   end loop;
   merged:=nustand_private.effective_source(p.source,p.research);
   merged:=nustand_private.effective_source(merged,payload-'status'-'error'-'requests'-'pages');
   update nustand_private.prospects set research=jsonb_build_object('contacts',merged->'contacts','fit',merged->'fit','job',payload->'job','website',coalesce(merged->'website',p.source->'website'),'contact_score',coalesce(merged->'contact_score','0'),'website_identity_review',coalesce(merged->'website_identity_review','false'),'website_source',merged->'website_source'),version=version+1,updated_at=now() where id=j.prospect_id;
 end if;
 update nustand_private.research_jobs set status=job_state,result=payload,error=left(payload->>'error',200),requests=least(25,greatest(0,coalesce((payload->>'requests')::integer,0))),pages=least(4,greatest(0,coalesce((payload->>'pages')::integer,0))),finished_at=now(),next_eligible_at=now()+case when job_state='blocked' then interval '180 days' when job_state='failed' then interval '1 day' else interval '30 days' end where id=j.id;
end $$;

create function public.nustand_research_queue(prospect_ids text[]) returns integer language sql security invoker set search_path=pg_catalog as $$select nustand_private.research_queue(prospect_ids)$$;
create function public.nustand_discovery_queue(area text, segment text, neighborhood text) returns uuid language sql security invoker set search_path=pg_catalog as $$select nustand_private.discovery_queue(area,segment,neighborhood)$$;
create function public.nustand_research_status() returns jsonb language sql security invoker set search_path=pg_catalog as $$select nustand_private.research_status()$$;
create function public.nustand_set_website(prospect_id text, website text) returns void language sql security invoker set search_path=pg_catalog as $$select nustand_private.set_website(prospect_id,website)$$;
create function public.nustand_worker_claim() returns jsonb language sql security invoker set search_path=pg_catalog as $$select nustand_private.worker_claim()$$;
create function public.nustand_worker_place_budget() returns boolean language sql security invoker set search_path=pg_catalog as $$select nustand_private.worker_place_budget()$$;
create function public.nustand_worker_finish(job_id uuid, lease_id uuid, payload jsonb) returns void language sql security invoker set search_path=pg_catalog as $$select nustand_private.worker_finish(job_id,lease_id,payload)$$;

revoke all on function nustand_private.research_queue(text[]),nustand_private.discovery_queue(text,text,text),nustand_private.research_status(),nustand_private.set_website(text,text),public.nustand_research_queue(text[]),public.nustand_discovery_queue(text,text,text),public.nustand_research_status(),public.nustand_set_website(text,text) from public,anon,authenticated;
grant execute on function nustand_private.research_queue(text[]),nustand_private.discovery_queue(text,text,text),nustand_private.research_status(),nustand_private.set_website(text,text),public.nustand_research_queue(text[]),public.nustand_discovery_queue(text,text,text),public.nustand_research_status(),public.nustand_set_website(text,text) to authenticated;
revoke all on function nustand_private.worker_claim(),nustand_private.worker_place_budget(),nustand_private.worker_finish(uuid,uuid,jsonb),public.nustand_worker_claim(),public.nustand_worker_place_budget(),public.nustand_worker_finish(uuid,uuid,jsonb) from public,anon,authenticated;
grant usage on schema nustand_private to service_role;
grant execute on function nustand_private.worker_claim(),nustand_private.worker_place_budget(),nustand_private.worker_finish(uuid,uuid,jsonb),public.nustand_worker_claim(),public.nustand_worker_place_budget(),public.nustand_worker_finish(uuid,uuid,jsonb) to service_role;
create or replace function nustand_private.nustand_review(prospect_id text, expected_version integer, next_review jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog as $$
declare current_row nustand_private.prospects%rowtype; decision record;
begin
  perform nustand_private.require_owner();
  select * into current_row from nustand_private.prospects where id = prospect_id for update;
  if not found then raise exception 'Prospect not found'; end if;
  if expected_version is null or current_row.version <> expected_version then raise exception 'This record changed. Reload the workspace before saving.' using errcode = '40001'; end if;
  if jsonb_typeof(next_review) is distinct from 'object'
    or coalesce(next_review->>'stage', '') not in ('New','Reviewing','Qualified','Contacted','Closed')
    or coalesce(next_review->>'segment', 'INVALID') not in ('','Wait','Presence','Dwell','Taste','Catalog')
    or jsonb_typeof(next_review->'notes') is distinct from 'string' or length(next_review->>'notes') > 20000
    or jsonb_typeof(next_review->'next_follow_up') is distinct from 'string'
    or (next_review->>'next_follow_up') !~ '^$|^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(next_review->'do_not_contact') is distinct from 'boolean'
    or jsonb_typeof(next_review->'contacts') is distinct from 'object'
    or not (next_review ? 'fit_score') or jsonb_typeof(next_review->'fit_score') not in ('number','null')
    or exists (select 1 from jsonb_object_keys(next_review) k where k not in ('stage','segment','notes','next_follow_up','do_not_contact','contacts','fit_score'))
    then raise exception 'Invalid review'; end if;
  if next_review->>'next_follow_up' <> '' then perform (next_review->>'next_follow_up')::date; end if;
  if jsonb_typeof(next_review->'fit_score') = 'number' and (
    (next_review->>'fit_score')::numeric < 0 or (next_review->>'fit_score')::numeric > 100 or
    trunc((next_review->>'fit_score')::numeric) <> (next_review->>'fit_score')::numeric
  ) then raise exception 'Invalid fit score'; end if;
  for decision in select key, value from jsonb_each_text(next_review->'contacts') loop
    if decision.value is null or decision.value not in ('accepted','rejected') or not exists (
      select 1 from jsonb_array_elements(nustand_private.effective_source(current_row.source,current_row.research)->'contacts') c where c->>'id' = decision.key
    ) then raise exception 'Invalid contact decision'; end if;
  end loop;
  -- Imported suppression cannot be cleared by a review.
  if current_row.source->>'do_not_contact' = 'true' or current_row.source->'original_record'->>'do_not_contact' = 'true' then
    next_review := jsonb_set(next_review, '{do_not_contact}', 'true');
  end if;
  update nustand_private.prospects set review = next_review, version = version + 1, updated_at = now() where id = prospect_id;
  insert into nustand_private.review_events (prospect_id, actor, previous_review, next_review, version)
    values (prospect_id, auth.uid(), current_row.review, next_review, current_row.version + 1);
  return current_row.version + 1;
end $$;

create or replace function nustand_private.nustand_export(prospect_ids text[]) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  perform nustand_private.require_owner();
  if prospect_ids is null or coalesce(array_length(prospect_ids, 1),0) > 500 then raise exception 'Invalid export selection'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('source', source, 'review', review, 'version', version) order by source->>'name', id), '[]'::jsonb)
  into result from nustand_private.prospect_rows p
  where p.id = any(prospect_ids)
    and review->>'stage' = 'Qualified'
    and not coalesce((source->>'do_not_contact')::boolean, false)
    and source->'original_record'->>'do_not_contact' is distinct from 'true'
    and not coalesce((review->>'do_not_contact')::boolean, false)
    and exists (select 1 from jsonb_array_elements(source->'contacts') c where review->'contacts'->>(c->>'id')='accepted');
  return result;
end $$;

create or replace function nustand_private.nustand_contact_value(prospect_id text, contact_id text) returns text
language plpgsql security definer set search_path = pg_catalog as $$
declare value text;
begin
  perform nustand_private.require_owner();
  select c->>'value' || case when coalesce(c->>'extension','') <> '' then ' ext ' || (c->>'extension') else '' end
    into value from nustand_private.prospect_rows p cross join lateral jsonb_array_elements(source->'contacts') c
    where p.id = prospect_id and c->>'id' = contact_id
    and review->'contacts'->>contact_id = 'accepted'
    and not coalesce((source->>'do_not_contact')::boolean, false)
    and source->'original_record'->>'do_not_contact' is distinct from 'true'
    and not coalesce((review->>'do_not_contact')::boolean, false);
  if value is null then raise exception 'Contact is no longer accepted or this space is suppressed. Reload to review the latest decision.'; end if;
  return value;
end $$;
commit;
