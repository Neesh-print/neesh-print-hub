-- Allow anyone to view basic publisher info (needed for magazine detail pages)
-- This is safe because it only exposes public business info, not sensitive data
DROP POLICY IF EXISTS "Anyone can view publisher info for active magazines" ON public.publishers;
CREATE POLICY "Anyone can view publisher info for active magazines" 
ON public.publishers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM magazines 
    WHERE magazines.publisher_id = publishers.id 
    AND magazines.is_active = true
  )
);