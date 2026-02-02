-- Add admin users to messageable_users view so they can create conversations
-- The current view only has a hardcoded Neesh Support placeholder, but admin users need
-- to be looked up by their actual auth.uid() when creating conversations.

DROP VIEW IF EXISTS public.messageable_users;

CREATE VIEW public.messageable_users
WITH (security_invoker = on) AS
-- Verified retailers
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

-- Verified publishers
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

-- Admin users from users table (for support/admin messaging)
SELECT
  u.id as id,
  u.id as user_id,
  'support'::text as user_type,
  COALESCE(p.full_name, p.business_name, 'Neesh Support') as display_name,
  p.avatar_url as avatar_url,
  NULL as city,
  NULL as state
FROM public.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.role = 'admin'

UNION ALL

-- Keep the Neesh Support placeholder for backward compatibility
-- (used when selecting "Neesh Support" from the user search)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid as id,
  '00000000-0000-0000-0000-000000000000'::uuid as user_id,
  'support'::text as user_type,
  'Neesh Support' as display_name,
  NULL as avatar_url,
  NULL as city,
  NULL as state;
