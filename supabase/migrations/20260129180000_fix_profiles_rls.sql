-- Allow authenticated users to view all profiles for messaging/discovery
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- Allow authenticated users to view all publishers for discovery
DROP POLICY IF EXISTS "Admins can manage all publishers" ON public.publishers;
-- Re-create admin management policy
CREATE POLICY "Admins can manage all publishers" ON public.publishers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Allow general view access
DROP POLICY IF EXISTS "Anyone can view verified publishers" ON public.publishers;
CREATE POLICY "Authenticated can view all publishers" ON public.publishers
FOR SELECT TO authenticated
USING (true);
