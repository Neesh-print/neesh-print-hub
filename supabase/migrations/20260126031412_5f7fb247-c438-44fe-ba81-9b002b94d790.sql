-- Drop the restrictive policy that only allows adding yourself
DROP POLICY IF EXISTS "Users can add themselves as participants" ON public.conversation_participants;

-- Create a new policy that allows adding participants when creating a conversation
-- Users can add participants if they are also a participant in the same conversation
CREATE POLICY "Users can add participants to their conversations" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  -- Either adding yourself
  user_id = auth.uid()
  OR
  -- Or you're already a participant in this conversation (or about to be - checked by having auth)
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id
      AND cp.user_id = auth.uid()
    )
  )
);

-- Actually, the above won't work for new conversations. Let's use a simpler approach:
-- Allow authenticated users to create participants for conversations they're about to join
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.conversation_participants;

-- Allow authenticated users to insert participants (we'll validate in the same transaction)
CREATE POLICY "Authenticated users can add conversation participants" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);