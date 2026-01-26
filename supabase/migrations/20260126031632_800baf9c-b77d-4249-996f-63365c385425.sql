-- Fix the conversations table RLS policy for INSERT
-- The current policy is too restrictive
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

-- Create a more permissive policy that allows any authenticated user to create conversations
CREATE POLICY "Authenticated users can create conversations" 
ON public.conversations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- This allows any authenticated user to create a conversation
-- We validate access through the conversation_participants table instead