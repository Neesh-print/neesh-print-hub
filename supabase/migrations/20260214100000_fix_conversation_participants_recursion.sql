-- Fix conversation_participants RLS infinite recursion
-- The previous policy (20260214000000) used a self-referencing subquery:
--   conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE ...)
-- This causes infinite recursion because reading conversation_participants triggers
-- the same SELECT policy, which tries to read conversation_participants again, etc.
--
-- Fix: Use a SECURITY DEFINER function to bypass RLS for the participant lookup.

-- Create helper function that runs as owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_conversation_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT conversation_id
  FROM public.conversation_participants
  WHERE user_id = p_user_id;
$$;

-- Drop the broken recursive policy and the old one
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;

-- Recreate with the SECURITY DEFINER function (no recursion)
CREATE POLICY "Users can view conversation participants"
ON public.conversation_participants FOR SELECT
USING (
  conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);
