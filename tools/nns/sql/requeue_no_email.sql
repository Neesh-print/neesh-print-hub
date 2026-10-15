-- Re-research every space that has no email yet, so the new email search runs on it:
-- unreadable robots.txt no longer blocks a site, likely contact pages are tried when
-- a site's menu has no links, a listing's phone is kept when there is no website,
-- and (if HUNTER_API_KEY is set) the email finder is asked about sites with no email.
-- Skips do-not-contact spaces and anything already queued. Safe to run more than once.
insert into nustand_private.research_jobs (prospect_id, kind)
select p.id, 'research' from nustand_private.prospects p
where coalesce(p.source->>'do_not_contact','false') <> 'true'
  and coalesce(p.review->>'do_not_contact','false') <> 'true'
  and coalesce(p.source->'original_record'->>'do_not_contact','false') <> 'true'
  and not exists (
    select 1 from jsonb_array_elements(coalesce(p.research->'contacts','[]'::jsonb)) c
    where c->>'kind' = 'email')
on conflict do nothing;

select count(*) as queued from nustand_private.research_jobs where status = 'queued';
