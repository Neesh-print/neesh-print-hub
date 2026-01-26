-- Fix the conversations RLS policies
-- Remove the conflicting public admin policy and replace with clearer ones

DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

-- Policy 1: Admins have full access (but don't apply this to everyone)
CREATE POLICY "Admins full access to conversations" 
ON public.conversations
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Policy 2: Any authenticated user can create a conversation (simple and clear)
CREATE POLICY "Anyone authenticated can create conversations" 
ON public.conversations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Do the same for conversation_participants
DROP POLICY IF EXISTS "Admins can manage all participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can add conversation participants" ON public.conversation_participants;

CREATE POLICY "Admins full access to participants" 
ON public.conversation_participants
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Anyone authenticated can add participants" 
ON public.conversation_participants 
FOR INSERT 
TO authenticated
WITH CHECK (true);