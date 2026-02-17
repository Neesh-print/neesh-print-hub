-- Fix public profile access for publisher and retailer public profile pages
-- The previous migration replaced the anon-accessible policy with authenticated-only,
-- which broke public profile pages for non-logged-in users.

-- Allow anyone (including anonymous/non-authenticated) to view approved publishers
-- This is needed for the /p/:slug public profile page
CREATE POLICY "Anyone can view approved publishers"
ON public.publishers FOR SELECT
USING (application_status = 'approved' OR verified = true);

-- Allow anyone to view verified retailers
-- This is needed for the /r/:slug public profile page
DROP POLICY IF EXISTS "Anyone can view verified retailers" ON public.retailers;
CREATE POLICY "Anyone can view verified retailers"
ON public.retailers FOR SELECT
USING (verified = true);

-- Also allow anonymous access to profiles for public profile pages
-- (needed to get avatar_url, bio etc for public profiles)
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;
CREATE POLICY "Anyone can view public profiles"
ON public.profiles FOR SELECT
USING (true);

-- Allow anonymous access to active magazines for public publisher profiles
DROP POLICY IF EXISTS "Anyone can view published magazines" ON public.magazines;
CREATE POLICY "Anyone can view published magazines"
ON public.magazines FOR SELECT
USING (is_active = true);
