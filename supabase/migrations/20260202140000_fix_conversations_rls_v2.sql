-- Fix RLS policy on conversations table
-- The current policy uses is_conversation_participant function which may have issues
-- This replaces it with a direct subquery that checks if auth.uid() is in conversation_participants

-- Drop all existing SELECT policies on conversations
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;

-- Create a simple, direct policy using EXISTS subquery
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
  );

-- Recreate admin policy
CREATE POLICY "Admins can manage all conversations"
  ON public.conversations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
