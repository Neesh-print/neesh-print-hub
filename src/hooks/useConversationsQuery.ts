/**
 * React Query hook for fetching conversations from Supabase
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Conversation, ConversationParticipant, UserType } from '@/types/messaging';

interface CurrentUser {
  id: string;
  type: UserType;
}

/**
 * Get the current user's type based on their role
 */
export function useCurrentMessagingUser(): CurrentUser | null {
  const { user, userRole } = useAuth();
  
  if (!user || !userRole) return null;
  
  // Map the user role to messaging user type
  const typeMap: Record<string, UserType> = {
    retailer: 'retailer',
    publisher: 'publisher',
    admin: 'support',
  };
  
  return {
    id: user.id,
    type: typeMap[userRole] || 'retailer',
  };
}

/**
 * Fetch all conversations for the current user
 */
export function useConversationsQuery() {
  const currentUser = useCurrentMessagingUser();
  
  return useQuery({
    queryKey: ['conversations', currentUser?.id, currentUser?.type],
    queryFn: async (): Promise<Conversation[]> => {
      if (!currentUser) return [];

      // First, get all conversation IDs where current user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.id)
        .eq('user_type', currentUser.type)
        .eq('is_archived', false);

      if (participantError) throw participantError;
      if (!participantData || participantData.length === 0) return [];
      
      const conversationIds = participantData.map(p => p.conversation_id);
      
      // Fetch conversations with their participants
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          updated_at,
          last_message_at,
          last_message_preview
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      
      if (conversationsError) throw conversationsError;
      if (!conversationsData) return [];

      // Fetch all participants for these conversations
      const { data: allParticipants, error: allParticipantsError } = await supabase
        .from('conversation_participants')
        .select('*')
        .in('conversation_id', conversationIds);
      
      if (allParticipantsError) throw allParticipantsError;
      
      // Map conversations with their participants and compute unread count
      const result = conversationsData.map(conv => {
        const participants = (allParticipants || [])
          .filter(p => p.conversation_id === conv.id)
          .map(p => ({
            id: p.id,
            conversation_id: p.conversation_id,
            user_id: p.user_id,
            user_type: p.user_type as UserType,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            joined_at: p.joined_at || '',
            last_read_at: p.last_read_at,
            is_muted: p.is_muted || false,
            is_archived: p.is_archived || false,
          })) as ConversationParticipant[];
        
        // Find the "other" participant (not current user)
        const otherParticipant = participants.find(
          p => !(p.user_id === currentUser.id && p.user_type === currentUser.type)
        );
        
        // Find current user's participant record for unread calculation
        const myParticipant = participants.find(
          p => p.user_id === currentUser.id && p.user_type === currentUser.type
        );
        
        // Calculate if unread (last_message_at > last_read_at)
        let unreadCount = 0;
        if (conv.last_message_at && myParticipant) {
          if (!myParticipant.last_read_at) {
            unreadCount = 1; // Never read = unread
          } else if (new Date(conv.last_message_at) > new Date(myParticipant.last_read_at)) {
            unreadCount = 1; // New messages since last read
          }
        }
        
        return {
          id: conv.id,
          created_at: conv.created_at || '',
          updated_at: conv.updated_at || '',
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_preview,
          participants,
          otherParticipant,
          unreadCount,
        } as Conversation;
      });

      return result;
    },
    enabled: !!currentUser,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Mark a conversation as read
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentMessagingUser();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!currentUser) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUser.id)
        .eq('user_type', currentUser.type);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Get total unread count across all conversations
 */
export function useTotalUnreadCount() {
  const { data: conversations } = useConversationsQuery();
  
  return conversations?.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0) || 0;
}
