-- Add missing columns to retailers table for profile completion feature

-- Contact information (from application)
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200);
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);

-- Profile completion fields
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS store_types TEXT[] DEFAULT '{}';
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500);
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS favorite_publisher_ids UUID[] DEFAULT '{}';
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE;

-- Create storage bucket for retailer profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('retailer-profiles', 'retailer-profiles', true, 5242880) -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage policies for retailer profile images
CREATE POLICY "Retailers can upload own profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'retailer-profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Retailers can update own profile images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'retailer-profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Retailers can delete own profile images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'retailer-profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Profile images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'retailer-profiles');