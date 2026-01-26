-- Drop the problematic policy
DROP POLICY IF EXISTS "Anyone can view publisher info for active magazines" ON public.publishers;

-- Create a security definer function to check if publisher has active magazines
-- This bypasses RLS and prevents recursion
CREATE OR REPLACE FUNCTION public.publisher_has_active_magazines(_publisher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM magazines 
    WHERE publisher_id = _publisher_id 
    AND is_active = true
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Anyone can view publisher info for active magazines" 
ON public.publishers 
FOR SELECT 
USING (public.publisher_has_active_magazines(id));