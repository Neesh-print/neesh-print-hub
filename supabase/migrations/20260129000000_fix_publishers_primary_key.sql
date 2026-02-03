-- Backfill missing publisher records for approved applications
-- This fixes the issue where approved publishers don't have matching id = user_id records

-- For each approved publisher application without a matching publisher record (where id = user_id)
-- Create a publisher with id = user_id
INSERT INTO public.publishers (id, user_id, company_name, description, verified, verified_at, website_url, instagram_handle)
SELECT 
  pa.user_id as id,
  pa.user_id,
  COALESCE(pa.business_name, pa.magazine_title) as company_name,
  pa.description,
  true as verified,
  COALESCE(pa.reviewed_at, NOW()) as verified_at,
  pa.social_website_link as website_url,
  REPLACE(pa.instagram_handle, '@', '') as instagram_handle
FROM publisher_applications pa
WHERE pa.status = 'approved'
  AND pa.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM publishers p WHERE p.id = pa.user_id
  )
ON CONFLICT (id) DO NOTHING;
