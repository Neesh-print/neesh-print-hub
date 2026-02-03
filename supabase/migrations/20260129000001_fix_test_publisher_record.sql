-- Fix existing publisher record where id != user_id
-- This updates the specific test publisher record to have matching id and user_id

-- First, delete the record with the wrong id
DELETE FROM public.publishers 
WHERE id = '838647e9-70f9-43f5-8d74-6ec090a2db48'::uuid 
  AND user_id = '8735729a-5caf-4e9d-a123-bdfb3ec3bbb9'::uuid;

-- Then insert it with the correct id = user_id
INSERT INTO public.publishers (
  id, 
  user_id, 
  company_name, 
  description, 
  website_url, 
  instagram_handle, 
  verified, 
  verified_at,
  application_status,
  current_onboarding_step
)
VALUES (
  '8735729a-5caf-4e9d-a123-bdfb3ec3bbb9'::uuid,  -- id = user_id
  '8735729a-5caf-4e9d-a123-bdfb3ec3bbb9'::uuid,
  'Indie Press Co',
  'We are Indie Press Co. We distribute the most niche queer publications in the Pacific North West!',
  'indiepressco',
  '@indiepressco',
  true,
  '2026-01-16 06:49:17.184+00',
  'approved',
  1
)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  company_name = EXCLUDED.company_name,
  description = EXCLUDED.description,
  website_url = EXCLUDED.website_url,
  instagram_handle = EXCLUDED.instagram_handle,
  verified = EXCLUDED.verified,
  verified_at = EXCLUDED.verified_at,
  application_status = EXCLUDED.application_status;
