-- =============================================================
-- Publisher Application Flow Refactor
-- Enables "Sign-Up First" flow with resume capability
-- =============================================================

-- 1. Create application status enum
DO $$ BEGIN
    CREATE TYPE publisher_application_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to publishers table
ALTER TABLE public.publishers
ADD COLUMN IF NOT EXISTS application_status publisher_application_status DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS current_onboarding_step INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS application_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Update existing publishers to 'approved' status (they were already verified)
UPDATE public.publishers
SET application_status = 'approved'
WHERE application_status IS NULL OR verified = true;

-- 4. Add index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_publishers_application_status
ON public.publishers(application_status);

CREATE INDEX IF NOT EXISTS idx_publishers_user_id_status
ON public.publishers(user_id, application_status);

-- =============================================================
-- RLS Policies for Draft Publishers
-- =============================================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Publishers can view own publisher record" ON public.publishers;
DROP POLICY IF EXISTS "Publishers can update own record" ON public.publishers;
DROP POLICY IF EXISTS "Draft publishers limited access" ON public.publishers;

-- Publishers can always view their own record
CREATE POLICY "Publishers can view own publisher record"
ON public.publishers FOR SELECT
USING (auth.uid() = user_id);

-- Publishers can update their own record (draft or approved)
CREATE POLICY "Publishers can update own record"
ON public.publishers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Publishers can insert their own record during signup
CREATE POLICY "Publishers can create own record"
ON public.publishers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- RLS: Restrict draft publishers from other tables
-- =============================================================

-- Magazines: Only approved publishers can manage magazines
DROP POLICY IF EXISTS "Publishers can manage own magazines" ON public.magazines;
CREATE POLICY "Approved publishers can manage own magazines"
ON public.magazines FOR ALL
USING (
  publisher_id IN (
    SELECT id FROM public.publishers
    WHERE user_id = auth.uid() AND application_status = 'approved'
  )
)
WITH CHECK (
  publisher_id IN (
    SELECT id FROM public.publishers
    WHERE user_id = auth.uid() AND application_status = 'approved'
  )
);

-- Orders: Only approved publishers can view orders
DROP POLICY IF EXISTS "Publishers can view orders for their magazines" ON public.orders;
DROP POLICY IF EXISTS "Publishers can update their orders" ON public.orders;

CREATE POLICY "Approved publishers can view their orders"
ON public.orders FOR SELECT
USING (
  magazine_id IN (
    SELECT m.id FROM public.magazines m
    JOIN public.publishers p ON m.publisher_id = p.id
    WHERE p.user_id = auth.uid() AND p.application_status = 'approved'
  )
);

CREATE POLICY "Approved publishers can update their orders"
ON public.orders FOR UPDATE
USING (
  magazine_id IN (
    SELECT m.id FROM public.magazines m
    JOIN public.publishers p ON m.publisher_id = p.id
    WHERE p.user_id = auth.uid() AND p.application_status = 'approved'
  )
);

-- =============================================================
-- Storage: Allow authenticated users to upload application files
-- =============================================================

-- Update applications bucket policy to allow any authenticated user
DROP POLICY IF EXISTS "Users can upload application files" ON storage.objects;
CREATE POLICY "Authenticated users can upload application files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'applications');

-- Also allow uploads to magazine-assets for draft publishers (cover images)
-- The existing policy already allows this, but let's be explicit
DROP POLICY IF EXISTS "Users can upload magazine assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload magazine assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'magazine-assets');

-- =============================================================
-- Add RLS policy for publisher_applications anonymous insert
-- (Matches retailer_applications behavior)
-- =============================================================

-- First ensure RLS is enabled
ALTER TABLE public.publisher_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit a publisher application
DROP POLICY IF EXISTS "Anyone can submit publisher application" ON public.publisher_applications;
CREATE POLICY "Anyone can submit publisher application"
ON public.publisher_applications FOR INSERT
WITH CHECK (true);

-- Applicants can view their own application by email
DROP POLICY IF EXISTS "Applicants can view own publisher applications" ON public.publisher_applications;
CREATE POLICY "Applicants can view own publisher applications"
ON public.publisher_applications FOR SELECT
USING (
  email = current_setting('request.jwt.claims', true)::json->>'email'
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- =============================================================
-- Helper function to get publisher status
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_publisher_status(p_user_id UUID)
RETURNS TABLE(
  publisher_id UUID,
  application_status publisher_application_status,
  current_step INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.application_status,
    p.current_onboarding_step
  FROM publishers p
  WHERE p.user_id = p_user_id;
END;
$$;

-- =============================================================
-- Security: Remove hardcoded keys from functions
-- Replace the notification functions with safer versions
-- =============================================================

-- Drop the old functions that had hardcoded keys
DROP FUNCTION IF EXISTS public.notify_publisher_application() CASCADE;
DROP FUNCTION IF EXISTS public.notify_retailer_application() CASCADE;

-- Recreate without hardcoded keys (use environment variables in edge function instead)
CREATE OR REPLACE FUNCTION public.notify_publisher_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notification is now handled by database webhooks or edge functions
  -- that read credentials from environment variables
  -- This trigger just logs the event
  RAISE NOTICE 'New publisher application: %', NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_retailer_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notification is now handled by database webhooks or edge functions
  RAISE NOTICE 'New retailer application: %', NEW.id;
  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS on_publisher_application_created ON public.publisher_applications;
CREATE TRIGGER on_publisher_application_created
  AFTER INSERT ON public.publisher_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_publisher_application();

DROP TRIGGER IF EXISTS on_retailer_application_created ON public.retailer_applications;
CREATE TRIGGER on_retailer_application_created
  AFTER INSERT ON public.retailer_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_retailer_application();

-- =============================================================
-- Comment for documentation
-- =============================================================

COMMENT ON COLUMN public.publishers.application_status IS 'Application flow status: draft (in progress), submitted (pending review), approved (can access dashboard), rejected';
COMMENT ON COLUMN public.publishers.current_onboarding_step IS 'Current step in the application form (1-13 for publisher application)';
COMMENT ON COLUMN public.publishers.application_data IS 'Partial form data saved during draft state for resume capability';
