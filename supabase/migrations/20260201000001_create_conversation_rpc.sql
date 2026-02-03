-- Create a secure RPC function to create a conversation and add participants atomically
-- This avoids RLS race conditions where the creator can't see the conversation they just made
-- because they haven't been added as a participant yet.

CREATE OR REPLACE FUNCTION public.create_conversation(
  p_other_user_id UUID,
  p_other_user_type VARCHAR,
  p_other_display_name VARCHAR DEFAULT NULL,
  p_other_avatar_url VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass RLS during creation
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_current_user_id UUID;
  v_current_user_type VARCHAR;
  v_current_display_name VARCHAR;
  v_current_avatar_url VARCHAR;
BEGIN
  -- Get current user ID
  v_current_user_id := auth.uid();
  If v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Determine current user type and details from messageable_users view
  -- We prioritize retailer, then publisher, then support (unlikely for auth.uid)
  SELECT 
    user_type, display_name, avatar_url 
  INTO 
    v_current_user_type, v_current_display_name, v_current_avatar_url
  FROM public.messageable_users 
  WHERE user_id = v_current_user_id
  LIMIT 1;

  IF v_current_user_type IS NULL THEN
    -- Fallback or error? Let's try to infer or error.
    -- If they aren't in messageable_users, they might not be fully onboarded.
    RAISE EXCEPTION 'User profile not found for messaging';
  END IF;

  -- 1. Create Conversation
  INSERT INTO public.conversations (created_at, updated_at)
  VALUES (NOW(), NOW())
  RETURNING id INTO v_conversation_id;

  -- 2. Add Current User as Participant
  INSERT INTO public.conversation_participants (
    conversation_id, 
    user_id, 
    user_type, 
    display_name, 
    avatar_url,
    joined_at
  ) VALUES (
    v_conversation_id,
    v_current_user_id,
    v_current_user_type,
    v_current_display_name,
    v_current_avatar_url,
    NOW()
  );

  -- 3. Add Other User as Participant
  INSERT INTO public.conversation_participants (
    conversation_id, 
    user_id, 
    user_type, 
    display_name, 
    avatar_url,
    joined_at
  ) VALUES (
    v_conversation_id,
    p_other_user_id,
    p_other_user_type,
    p_other_display_name,
    p_other_avatar_url,
    NOW()
  );

  RETURN v_conversation_id;
END;
$$;
