import { MessageSquare } from 'lucide-react';
import { ConversationListItem } from './ConversationListItem';
import { ConversationListSkeleton } from './ConversationListSkeleton';
import type { Conversation, UserType } from '@/types/messaging';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string;
  currentUserType: UserType;
  isLoading?: boolean;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  currentUserType,
  isLoading,
  onSelect,
}: ConversationListProps) {
  if (isLoading) {
    return <ConversationListSkeleton />;
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No conversations yet</p>
          <p className="text-sm mt-1">Start a new message to connect with others</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          isSelected={conversation.id === selectedId}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          onClick={() => onSelect(conversation.id)}
        />
      ))}
    </div>
  );
}
