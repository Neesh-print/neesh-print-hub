/**
 * Messaging System Types
 * Foundation types for platform messaging between retailers, publishers, and support.
 */

export type UserType = 'retailer' | 'publisher' | 'support';

export interface MessageableUser {
  id: string;
  user_id: string;
  user_type: UserType;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  participants?: ConversationParticipant[];
  // Computed fields for UI
  otherParticipant?: ConversationParticipant;
  unreadCount?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  user_type: UserType;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  is_archived: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: UserType;
  content: string;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
  related_product_id: string | null;
  related_order_id: string | null;
  // Joined data
  sender?: MessageableUser;
}

// Grouped messages for date separators in UI
export interface MessageGroup {
  date: string;
  dateLabel: string;
  messages: Message[];
}

// For creating new conversations
export interface CreateConversationParams {
  participantId: string;
  participantType: UserType;
  initialMessage?: string;
}

// For sending messages
export interface SendMessageParams {
  conversationId: string;
  content: string;
  relatedProductId?: string;
  relatedOrderId?: string;
}

// Avatar helper return type
export interface AvatarProps {
  initials: string;
  bgColor: string;
}
