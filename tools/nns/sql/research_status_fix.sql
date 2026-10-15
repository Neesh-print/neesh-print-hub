-- Nustand: fix research_status. Its result variable had the same name as the
-- research_jobs.result column, so Postgres refused the query ("column reference
-- result is ambiguous") and the Find new leads panel could never load.
create or replace function nustand_private.research_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare status_json jsonb;
begin
 perform nustand_private.require_owner();
 select coalesce(jsonb_agg(to_jsonb(j)-'lease'-'lease_until'),'[]') into status_json
 from (
   select r.id, r.prospect_id, r.kind, r.input, r.status, r.created_at, r.finished_at, r.error, r.requests, r.pages,
     case when r.kind='discovery' then r.result else null end as result
   from nustand_private.research_jobs r order by r.created_at desc limit 600
 ) j;
 return jsonb_build_object('enabled',coalesce((select enabled from nustand_private.research_settings),false),'jobs',status_json);
end $$;
