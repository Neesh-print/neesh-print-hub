import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatConversationTime, getAvatarProps } from '@/lib/messaging';
import type { Conversation, ConversationParticipant, UserType } from '@/types/messaging';

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  currentUserId: string;
  currentUserType: UserType;
  onClick: () => void;
}

const userTypeLabels: Record<UserType, string> = {
  retailer: 'Retailer',
  publisher: 'Publisher',
  support: 'Support',
};

export function ConversationListItem({
  conversation,
  isSelected,
  currentUserId,
  currentUserType,
  onClick,
}: ConversationListItemProps) {
  // Get the other participant (not current user)
  const otherParticipant = useMemo(() => {
    return conversation.participants?.find(
      (p) => !(p.user_id === currentUserId && p.user_type === currentUserType)
    ) || conversation.otherParticipant;
  }, [conversation.participants, conversation.otherParticipant, currentUserId, currentUserType]);

  const isUnread = (conversation.unreadCount || 0) > 0;

  const { initials, bgColor } = getAvatarProps(otherParticipant?.display_name || null);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 text-left transition-colors border-b border-border',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted',
        isUnread && !isSelected && 'bg-muted/50'
      )}
    >
      <div className="flex gap-3">
        <div className="relative flex-shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={otherParticipant?.avatar_url || undefined} />
            <AvatarFallback className={cn(bgColor, 'text-white text-sm font-medium')}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {isUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'truncate text-sm',
                isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground'
              )}
            >
              {otherParticipant?.display_name || 'Unknown'}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatConversationTime(conversation.last_message_at)}
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            {userTypeLabels[otherParticipant?.user_type || 'retailer']}
          </div>

          <div className="flex items-center justify-between mt-1 gap-2">
            <span
              className={cn(
                'text-sm truncate',
                isUnread ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {conversation.last_message_preview || 'No messages yet'}
            </span>
            {isUnread && (
              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
