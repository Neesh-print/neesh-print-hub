-- Nustand: newer research must update a known contact's fields (rank, quality,
-- review reasons), not only append evidence. Imported originals in
-- prospects.source are untouched; this only changes how research is merged.
create or replace function nustand_private.effective_source(raw jsonb, researched jsonb) returns jsonb
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
     -- Newer research wins field by field; evidence is the union of both.
     item := prior || item || jsonb_build_object('evidence',combined);
   end if;
   contacts := jsonb_set(contacts,array[item->>'id'],item);
 end loop;
 select coalesce(jsonb_agg(value order by key),'[]') into combined from jsonb_each(contacts);
 return raw || (researched - 'id' - 'name' - 'original_record' - 'do_not_contact' - 'contacts') || jsonb_build_object('contacts',combined);
end $$;
revoke all on function nustand_private.effective_source(jsonb,jsonb) from public,anon,authenticated;
