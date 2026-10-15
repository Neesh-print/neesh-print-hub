-- Nustand: the owner confirms that a found website belongs to the space.
-- Clears the website-identity flag and the matching review reason on that
-- space's researched contacts. Imported originals and review decisions are
-- untouched; other review reasons stay. Owner-only, up to 500 spaces per call.
create function nustand_private.confirm_websites(prospect_ids text[]) returns integer
language plpgsql security definer set search_path = pg_catalog as $$
declare changed integer;
begin
  perform nustand_private.require_owner();
  if prospect_ids is null or cardinality(prospect_ids) not between 1 and 500 then
    raise exception 'Select 1–500 spaces';
  end if;
  update nustand_private.prospects p set
    research = p.research
      || jsonb_build_object('website_identity_review', false, 'website_source', 'owner_confirmed')
      || jsonb_build_object('contacts', coalesce((
           select jsonb_agg(
             case when c ? 'review_reasons'
               then jsonb_set(c, '{review_reasons}', coalesce((
                 select jsonb_agg(r) from jsonb_array_elements(c->'review_reasons') r
                 where r <> '"website_identity_needs_review"'::jsonb), '[]'::jsonb))
               else c end)
           from jsonb_array_elements(coalesce(p.research->'contacts', '[]'::jsonb)) c), '[]'::jsonb)),
    version = p.version + 1,
    updated_at = now()
  where p.id = any(prospect_ids)
    and nullif(p.research->>'website', '') is not null
    and coalesce((p.research->>'website_identity_review')::boolean, false);
  get diagnostics changed = row_count;
  return changed;
end $$;

create function public.nustand_confirm_websites(prospect_ids text[]) returns integer
language sql security invoker set search_path = pg_catalog as $$select nustand_private.confirm_websites(prospect_ids)$$;

revoke all on function nustand_private.confirm_websites(text[]), public.nustand_confirm_websites(text[]) from public, anon, authenticated;
grant execute on function nustand_private.confirm_websites(text[]), public.nustand_confirm_websites(text[]) to authenticated;
