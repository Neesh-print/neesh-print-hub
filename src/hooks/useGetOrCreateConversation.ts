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

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Get current user's display info from messageable_users
      const { data: currentUserData } = await supabase
        .from('messageable_users')
        .select('display_name, avatar_url')
        .eq('user_id', currentUser.id)
        .eq('user_type', currentUser.type)
        .maybeSingle();

      // Add both participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          {
            conversation_id: conversation.id,
            user_id: currentUser.id,
            user_type: currentUser.type,
            display_name: currentUserData?.display_name || 'Unknown',
            avatar_url: currentUserData?.avatar_url,
          },
          {
            conversation_id: conversation.id,
            user_id: userId,
            user_type: userType,
            display_name: displayName || 'Unknown',
            avatar_url: avatarUrl,
          },
        ]);

      if (partError) throw partError;

      return conversation.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
