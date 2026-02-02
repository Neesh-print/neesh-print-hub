/**
 * Hook to find an existing conversation or create a new one
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentMessagingUser } from './useConversationsQuery';
import type { UserType } from '@/types/messaging';

interface GetOrCreateParams {
  userId: string;
  userType: UserType;
  displayName?: string;
  avatarUrl?: string | null;
}

export function useGetOrCreateConversation() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentMessagingUser();

  return useMutation({
    mutationFn: async ({
      userId,
      userType,
      displayName,
      avatarUrl,
    }: GetOrCreateParams): Promise<string> => {
      if (!currentUser) throw new Error('Not authenticated');

      // Check for existing conversation using the database function
      const { data: existingConvId, error: findError } = await supabase.rpc(
        'find_conversation',
        {
          user1_id: currentUser.id,
          user1_type: currentUser.type,
          user2_id: userId,
          user2_type: userType,
        }
      );

      if (findError) throw findError;

      // If conversation exists, return its ID
      if (existingConvId) {
        return existingConvId;
      }

      // Create new conversation via RPC to handle RLS safety
      const { data: conversationId, error: createError } = await supabase.rpc(
        'create_conversation',
        {
          p_other_user_id: userId,
          p_other_user_type: userType,
          p_other_display_name: displayName || 'Unknown',
          p_other_avatar_url: avatarUrl || null,
        }
      );

      if (createError) throw createError;
      if (!conversationId) throw new Error('Failed to create conversation');

      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
