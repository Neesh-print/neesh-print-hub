-- Create storage bucket for magazine assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('magazine-assets', 'magazine-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload magazine assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'magazine-assets');

-- Allow anyone to view magazine assets (public catalogue)
CREATE POLICY "Anyone can view magazine assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'magazine-assets');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'magazine-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'magazine-assets' AND auth.uid()::text = (storage.foldername(name))[1]);