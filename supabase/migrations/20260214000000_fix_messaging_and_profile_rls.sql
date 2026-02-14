-- Fix Messaging 403 Forbidden (Issue #2)
-- Users need to see all participants in conversations they belong to
-- The previous fix only addressed the conversations table, not conversation_participants
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
CREATE POLICY "Users can view conversation participants"
ON public.conversation_participants FOR SELECT
USING (
  user_id = auth.uid() OR
  conversation_id IN (
    SELECT conversation_id
    FROM public.conversation_participants
    WHERE user_id = auth.uid()
  )
);

-- Fix Retailer Profile Persistence (Issue #6)
-- The UPDATE policy was silently blocking profile saves
DROP POLICY IF EXISTS "Retailers can update their own profile" ON public.retailers;
CREATE POLICY "Retailers can update their own profile"
ON public.retailers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
