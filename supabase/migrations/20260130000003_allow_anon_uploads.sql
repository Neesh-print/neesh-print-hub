-- Allow anonymous uploads to magazine-assets bucket
-- This is required for the publisher application flow where users can upload cover images before creating an account or logging in

BEGIN;

-- Check if policy exists and drop if so to avoid conflicts
DROP POLICY IF EXISTS "Allow anonymous uploads to magazine-assets" ON storage.objects;

-- Create policy for anonymous uploads
-- Allow Access to the 'anonymous' folder specifically
CREATE POLICY "Allow anonymous uploads to magazine-assets"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'magazine-assets' AND
  (storage.foldername(name))[1] = 'anonymous'
);

-- Also allow public select access to these files so they can be viewed
DROP POLICY IF EXISTS "Allow public view of anonymous uploads" ON storage.objects;

CREATE POLICY "Allow public view of anonymous uploads"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'magazine-assets' AND
  (storage.foldername(name))[1] = 'anonymous'
);

COMMIT;
