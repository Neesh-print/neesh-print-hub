/**
 * React Query hooks for Messages with Supabase integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentMessagingUser } from './useConversationsQuery';
import type { Message, Conversation, ConversationParticipant, UserType } from '@/types/messaging';

/**
 * Fetch a single conversation with participants
 */
export function useConversationQuery(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async (): Promise<Conversation | null> => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          updated_at,
          last_message_at,
          last_message_preview,
          participants:conversation_participants (
            id,
            conversation_id,
            user_id,
            user_type,
            display_name,
            avatar_url,
            joined_at,
            last_read_at,
            is_muted,
            is_archived
          )
        `)
        .eq('id', conversationId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        created_at: data.created_at ?? '',
        updated_at: data.updated_at ?? '',
        last_message_at: data.last_message_at,
        last_message_preview: data.last_message_preview,
        participants: (data.participants || []).map((p): ConversationParticipant => ({
          id: p.id,
          conversation_id: p.conversation_id,
          user_id: p.user_id,
          user_type: p.user_type as UserType,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          joined_at: p.joined_at ?? '',
          last_read_at: p.last_read_at,
          is_muted: p.is_muted ?? false,
          is_archived: p.is_archived ?? false,
        })),
      };
    },
    enabled: !!conversationId,
    staleTime: 30000,
  });
}

/**
 * Fetch messages for a conversation
 */
export function useMessagesQuery(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((msg): Message => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        sender_type: msg.sender_type as UserType,
        content: msg.content,
        created_at: msg.created_at ?? '',
        edited_at: msg.edited_at,
        is_deleted: msg.is_deleted ?? false,
        related_product_id: msg.related_product_id,
        related_order_id: msg.related_order_id,
      }));
    },
    enabled: !!conversationId,
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Send a message to a conversation
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentMessagingUser();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      relatedProductId,
      relatedOrderId,
    }: {
      conversationId: string;
      content: string;
      relatedProductId?: string;
      relatedOrderId?: string;
    }) => {
      if (!currentUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          sender_type: currentUser.type,
          content: content.trim(),
          related_product_id: relatedProductId || null,
          related_order_id: relatedOrderId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ conversationId, content }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', conversationId]);

      // Optimistically add the new message
      if (currentUser) {
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: currentUser.id,
          sender_type: currentUser.type,
          content: content.trim(),
          created_at: new Date().toISOString(),
          edited_at: null,
          is_deleted: false,
          related_product_id: null,
          related_order_id: null,
        };

        queryClient.setQueryData<Message[]>(
          ['messages', conversationId],
          (old) => [...(old || []), optimisticMessage]
        );
      }

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ['messages', variables.conversationId],
          context.previousMessages
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Mark a conversation as read (update last_read_at)
 */
export function useMarkConversationAsRead(conversationId: string | null) {
  const currentUser = useCurrentMessagingUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !currentUser) return;

    const markAsRead = async () => {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUser.id)
        .eq('user_type', currentUser.type);

      if (!error) {
        // Invalidate to update unread counts
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(markAsRead, 100);
    return () => clearTimeout(timer);
  }, [conversationId, currentUser?.id, currentUser?.type, queryClient]);
}
