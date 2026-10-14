-- SELECT only. Save privately and unwrap "record" values into {"records":[...]}.
-- This sample is not a full backup or migration.
SELECT to_jsonb(l) AS record
FROM public.leads l
WHERE lower(trim(coalesce(to_jsonb(l)->>'city', ''))) IN
  ('new york', 'nyc', 'new york city', 'manhattan', 'brooklyn', 'queens',
   'bronx', 'the bronx', 'staten island')
  AND nullif(trim(to_jsonb(l)->>'website'), '') IS NOT NULL
  AND lower(coalesce(to_jsonb(l)->>'is_merged', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(coalesce(to_jsonb(l)->>'is_invalid', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(coalesce(to_jsonb(l)->>'do_not_contact', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(coalesce(to_jsonb(l)->>'opted_out', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(coalesce(to_jsonb(l)->>'unsubscribed', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(coalesce(to_jsonb(l)->>'suppressed', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(trim(coalesce(to_jsonb(l)->>'status', ''))) NOT IN
    ('do not contact', 'do_not_contact', 'unsubscribed', 'opted out', 'opt_out', 'suppressed')
  AND lower(trim(coalesce(to_jsonb(l)->>'stage', ''))) NOT IN
    ('do not contact', 'do_not_contact', 'unsubscribed', 'opted out', 'opt_out', 'suppressed')
ORDER BY md5((to_jsonb(l)->>'id') || ':nns-2026-10-14-v1')
LIMIT 100;
