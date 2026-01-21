-- Drop unused password column from publisher_applications
-- This column is not used by application code and poses security risk
ALTER TABLE publisher_applications DROP COLUMN IF EXISTS password;

-- Create a private bucket for application submissions (cover images during application)
-- Note: This is handled via storage bucket creation below
-- The magazine-assets bucket remains public for catalog images

-- Add storage policies for the new private applications bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload to applications bucket
CREATE POLICY "Users can upload application files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'applications');

-- Policy: Users can view their own application files
CREATE POLICY "Users can view own application files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'applications' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Admins can view all application files
CREATE POLICY "Admins can view all application files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'applications' 
  AND EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Users can delete their own application files
CREATE POLICY "Users can delete own application files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'applications' AND auth.uid()::text = (storage.foldername(name))[1]);