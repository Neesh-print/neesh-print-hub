-- Nustand: tag spaces with neighborhood, type and ICP, and let discovery add more leads.
-- 1. The worker receives a space's existing tags so it doesn't look them up again.
-- 2. Research results keep neighborhood, borough, address and space type.
-- 3. Workspace capacity rises from 500 to 2,000 spaces.
-- 4. Re-queue the existing spaces once so they get tagged.

create or replace function nustand_private.worker_claim() returns jsonb
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
     effective:=jsonb_build_object('id',effective->'id','name',effective->'name','city',effective->'city','website',effective->'website','website_source',effective->'website_source','website_identity_review',effective->'website_identity_review','discovery',effective->'discovery','space_type',effective->'space_type','neighborhood',effective->'neighborhood','fit',jsonb_build_object('segment',effective->'fit'->'segment'),'original_record',coalesce((select jsonb_object_agg(key,value) from jsonb_each(effective->'original_record') where key in ('country','email','phone','instagram_handle','instagram_url','additional_contacts','business_type','category','manual_overrides','segment','quadrant','motion','budget_type','fit_score')),'{}'));
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

create or replace function nustand_private.worker_finish(job_id uuid, lease_id uuid, payload jsonb) returns void
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
   update nustand_private.prospects set research=jsonb_build_object('contacts',merged->'contacts','fit',merged->'fit','job',payload->'job','website',coalesce(merged->'website',p.source->'website'),'contact_score',coalesce(merged->'contact_score','0'),'website_identity_review',coalesce(merged->'website_identity_review','false'),'website_source',merged->'website_source') || jsonb_strip_nulls(jsonb_build_object('neighborhood',merged->'neighborhood','borough',merged->'borough','address',merged->'address','space_type',merged->'space_type')),version=version+1,updated_at=now() where id=j.prospect_id;
 end if;
 update nustand_private.research_jobs set status=job_state,result=payload,error=left(payload->>'error',200),requests=least(25,greatest(0,coalesce((payload->>'requests')::integer,0))),pages=least(4,greatest(0,coalesce((payload->>'pages')::integer,0))),finished_at=now(),next_eligible_at=now()+case when job_state='blocked' then interval '180 days' when job_state='failed' then interval '1 day' else interval '30 days' end where id=j.id;
end $$;

create or replace function nustand_private.nustand_import(records jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare item jsonb; contact jsonb; added integer := 0; inserted integer;
begin
  perform nustand_private.require_owner();
  perform pg_advisory_xact_lock(723407100); -- Serialize the workspace capacity check.
  if jsonb_typeof(records) is distinct from 'array' or jsonb_array_length(records) not between 1 and 500
     or octet_length(records::text) > 10000000 then raise exception 'Invalid pilot batch'; end if;
  if (select count(distinct r->>'id') from jsonb_array_elements(records) r) <> jsonb_array_length(records) then
    raise exception 'Duplicate prospect IDs';
  end if;
  for item in select value from jsonb_array_elements(records) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') not between 1 and 200
      or jsonb_typeof(item->'name') is distinct from 'string' or length(item->>'name') not between 1 and 500
      or jsonb_typeof(item->'do_not_contact') is distinct from 'boolean'
      or jsonb_typeof(item->'original_record') is distinct from 'object'
      or jsonb_typeof(item->'contacts') is distinct from 'array'
      or jsonb_typeof(item->'job') is distinct from 'object'
      or jsonb_typeof(item->'job'->'status') is distinct from 'string'
      or jsonb_typeof(item->'fit') is distinct from 'object'
      or not (item->'fit' ? 'score')
      or jsonb_typeof(item->'fit'->'score') not in ('number', 'null') then raise exception 'Invalid prospect'; end if;
    if jsonb_array_length(item->'contacts') > 1000 then raise exception 'Too many contacts'; end if;
    if (select count(distinct c->>'id') from jsonb_array_elements(item->'contacts') c) <> jsonb_array_length(item->'contacts') then raise exception 'Duplicate contact IDs'; end if;
    for contact in select value from jsonb_array_elements(item->'contacts') loop
      if jsonb_typeof(contact) is distinct from 'object'
        or jsonb_typeof(contact->'id') is distinct from 'string' or length(contact->>'id') not between 1 and 200
        or coalesce(contact->>'kind', '') not in ('email','phone','instagram')
        or jsonb_typeof(contact->'value') is distinct from 'string' or length(contact->>'value') not between 1 and 500
        or jsonb_typeof(contact->'quality_status') is distinct from 'string'
        or jsonb_typeof(contact->'evidence') is distinct from 'array'
        or jsonb_typeof(contact->'review_reasons') is distinct from 'array' then raise exception 'Invalid contact'; end if;
    end loop;
    insert into nustand_private.prospects (id, source) values (item->>'id', item) on conflict (id) do nothing;
    get diagnostics inserted = row_count;
    added := added + inserted;
  end loop;
  -- Raised from 500 so discovery can keep adding leads; the list paginates.
  if (select count(*) from nustand_private.prospects) > 2000 then raise exception 'Workspace capacity is 2,000 spaces'; end if;
  return added;
end $function$;

-- Tag the spaces already in Nustand (one research pass each; skips do-not-contact).
insert into nustand_private.research_jobs (prospect_id, kind)
select p.id, 'research' from nustand_private.prospects p
where coalesce(p.source->>'do_not_contact','false') <> 'true'
  and coalesce(p.review->>'do_not_contact','false') <> 'true'
  and nullif(p.research->>'space_type','') is null
on conflict do nothing;
