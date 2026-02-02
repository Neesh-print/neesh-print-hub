-- Fix conversations table RLS policy for SELECT
-- The issue is that the is_conversation_participant function may not work correctly
-- when retailers query conversations they participate in.

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

-- Create a more reliable SELECT policy using a direct subquery
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id
        AND cp.user_id = auth.uid()
    )
  );

-- Also ensure the helper function is working correctly
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
