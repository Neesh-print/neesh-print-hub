/**
 * Hook to get the unread message count for the current user
 * Used for displaying badges in navigation
 */
import { useMemo } from 'react';
import { useConversationsQuery, useCurrentMessagingUser } from './useConversationsQuery';

export function useUnreadMessageCount() {
  const currentUser = useCurrentMessagingUser();
  const { data: conversations } = useConversationsQuery();

  const unreadCount = useMemo(() => {
    if (!conversations || !currentUser) return 0;

    return conversations.filter((conv) => {
      // Get current user's participant record
      const myParticipant = conv.participants?.find(
        (p) => p.user_id === currentUser.id && p.user_type === currentUser.type
      );

      // If there's no last message, nothing to be unread
      if (!conv.last_message_at) return false;

      // If user hasn't read anything, all messages are unread
      if (!myParticipant?.last_read_at) return true;

      // Compare timestamps to see if there are unread messages
      return new Date(conv.last_message_at) > new Date(myParticipant.last_read_at);
    }).length;
  }, [conversations, currentUser]);

  return unreadCount;
}
