-- =============================================
-- MESSAGING SYSTEM SCHEMA
-- =============================================

-- Drop existing messaging tables if they exist (to start fresh)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.message_threads CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP VIEW IF EXISTS public.messageable_users CASCADE;

-- =============================================
-- 1. MESSAGEABLE USERS VIEW
-- Unified view of all users who can participate in messaging
-- =============================================
CREATE VIEW public.messageable_users AS
SELECT 
  id,
  user_id,
  'retailer' as user_type,
  shop_name as display_name,
  profile_image_url as avatar_url,
  city,
  state
FROM public.retailers
WHERE verified = true

UNION ALL

SELECT 
  id,
  user_id,
  'publisher' as user_type,
  company_name as display_name,
  NULL as avatar_url,
  NULL as city,
  NULL as state
FROM public.publishers
WHERE verified = true

UNION ALL

SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid as id,
  '00000000-0000-0000-0000-000000000000'::uuid as user_id,
  'support' as user_type,
  'Neesh Support' as display_name,
  NULL as avatar_url,
  NULL as city,
  NULL as state;

-- =============================================
-- 2. CONVERSATIONS TABLE
-- =============================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT
);

CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. CONVERSATION PARTICIPANTS TABLE
-- =============================================
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('retailer', 'publisher', 'support')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  display_name VARCHAR(200),
  avatar_url VARCHAR(500),
  
  UNIQUE(conversation_id, user_id, user_type)
);

CREATE INDEX idx_participants_user ON public.conversation_participants(user_id, user_type);
CREATE INDEX idx_participants_conversation ON public.conversation_participants(conversation_id);

-- Enable RLS
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. MESSAGES TABLE
-- =============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('retailer', 'publisher', 'support')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT FALSE,
  related_product_id UUID,
  related_order_id UUID
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id, sender_type);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. TRIGGER: Update conversation on new message
-- =============================================
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER message_insert_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();

-- =============================================
-- 6. FUNCTION: Find existing conversation between two users
-- =============================================
CREATE OR REPLACE FUNCTION public.find_conversation(
  user1_id UUID,
  user1_type VARCHAR(20),
  user2_id UUID,
  user2_type VARCHAR(20)
)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
BEGIN
  SELECT cp1.conversation_id INTO conv_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = user1_id 
    AND cp1.user_type = user1_type
    AND cp2.user_id = user2_id 
    AND cp2.user_type = user2_type
  LIMIT 1;
  
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- 7. HELPER FUNCTION: Check if user is participant
-- =============================================
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- 8. RLS POLICIES
-- =============================================

-- Conversations: Users can view conversations they participate in
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_participant(id, auth.uid()));

-- Conversations: Any authenticated user can create a conversation
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Conversations: Participants can update conversation
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (public.is_conversation_participant(id, auth.uid()));

-- Conversation Participants: Users can view participants of their conversations
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

-- Conversation Participants: Users can add themselves as participants
CREATE POLICY "Users can add themselves as participants"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Conversation Participants: Users can update their own participant record
CREATE POLICY "Users can update their own participant record"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Messages: Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

-- Messages: Users can send messages to their conversations
CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Messages: Users can update their own messages (for editing)
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Admin policies
CREATE POLICY "Admins can manage all conversations"
  ON public.conversations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can manage all participants"
  ON public.conversation_participants FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can manage all messages"
  ON public.messages FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());