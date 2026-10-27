-- Reviewed upgrade for CSV imports. Changes only Nustand functions.
-- Existing sources, reviews, owner and grants are preserved.
begin;
create or replace function nustand_private.nustand_import(records jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog as $$
declare item jsonb; contact jsonb; added integer := 0; inserted integer;
begin
  perform nustand_private.require_owner();
  perform pg_advisory_xact_lock(723407100); -- Serialize the 500-row workspace capacity check.
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
  -- Deliberately cap this milestone. Add pagination before expanding the dataset.
  if (select count(*) from nustand_private.prospects) > 500 then raise exception 'Workspace capacity is 500 spaces'; end if;
  return added;
end $$;

create or replace function nustand_private.nustand_export(prospect_ids text[]) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  perform nustand_private.require_owner();
  if prospect_ids is null or coalesce(array_length(prospect_ids, 1),0) > 500 then raise exception 'Invalid export selection'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('source', source, 'review', review, 'version', version) order by source->>'name', id), '[]'::jsonb)
  into result from nustand_private.prospects p
  where p.id = any(prospect_ids)
    and review->>'stage' = 'Qualified'
    and not coalesce((source->>'do_not_contact')::boolean, false)
    and source->'original_record'->>'do_not_contact' is distinct from 'true'
    and not coalesce((review->>'do_not_contact')::boolean, false)
    and exists (select 1 from jsonb_array_elements(source->'contacts') c where review->'contacts'->>(c->>'id')='accepted');
  return result;
end $$;

commit;
;
