-- Fix conversation_participants RLS infinite recursion (v2)
-- The policy from 20260214000000 used a self-referencing subquery causing infinite
-- recursion and 500 errors. Fix: use the existing is_conversation_participant()
-- SECURITY DEFINER function which bypasses RLS when querying the same table.

-- Drop ALL existing SELECT policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;

-- Recreate using the existing SECURITY DEFINER function (no recursion)
-- is_conversation_participant(conv_id, user_id) checks if user_id is in the
-- conversation, running as function owner to bypass RLS.
CREATE POLICY "Users can view conversation participants"
ON public.conversation_participants FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
);
