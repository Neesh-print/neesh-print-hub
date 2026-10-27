-- =============================================================
-- Allow anonymous access to public publisher profile data
--
-- The PublisherPublicProfile page (/p/:slug) queries:
--   publishers -> users!inner(created_at, profiles(avatar_url, city, state, bio))
--   magazines (where is_active = true)
--
-- The `publishers`, `profiles`, and `magazines` tables already have
-- anonymous SELECT policies. But the `users` table only allows
-- auth.uid() = id (own record) or admin, which blocks the join
-- for unauthenticated visitors.
--
-- Fix: Add a narrow anonymous SELECT policy on `users` that only
-- exposes records belonging to approved/verified publishers.
-- =============================================================

-- Allow anonymous users to read user records for approved publishers
-- (needed for the publishers -> users join in public profiles)
CREATE POLICY "Anyone can view users of approved publishers"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.publishers
    WHERE publishers.user_id = users.id
    AND (publishers.application_status = 'approved' OR publishers.verified = true)
  )
);
