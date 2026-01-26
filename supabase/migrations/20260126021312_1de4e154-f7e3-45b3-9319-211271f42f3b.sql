-- Fix security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.messageable_users;

CREATE VIEW public.messageable_users 
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  'retailer'::text as user_type,
  shop_name as display_name,
  profile_image_url as avatar_url,
  city,
  state
FROM public.retailers
WHERE verified = true

UNION ALL

SELECT 
  id,
  user_id,
  'publisher'::text as user_type,
  company_name as display_name,
  NULL as avatar_url,
  NULL as city,
  NULL as state
FROM public.publishers
WHERE verified = true

UNION ALL

SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid as id,
  '00000000-0000-0000-0000-000000000000'::uuid as user_id,
  'support'::text as user_type,
  'Neesh Support' as display_name,
  NULL as avatar_url,
  NULL as city,
  NULL as state;