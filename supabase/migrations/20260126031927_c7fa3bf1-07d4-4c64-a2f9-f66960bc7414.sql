-- Fix conversations INSERT policy - ensure it properly allows authenticated users
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations" 
ON public.conversations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also fix conversation_participants INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add conversation participants" ON public.conversation_participants;

CREATE POLICY "Authenticated users can add conversation participants" 
ON public.conversation_participants 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);