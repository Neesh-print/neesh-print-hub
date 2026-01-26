/**
 * Message Thread View Component
 * Full conversation view with header, messages, and composer
 */

import { ArrowLeft, Package } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';
import { useConversationQuery, useSendMessage } from '@/hooks/useMessagesQuery';
import { getAvatarProps } from '@/lib/messaging';
import type { UserType, ConversationParticipant } from '@/types/messaging';

interface MessageThreadViewProps {
  conversationId: string;
  currentUserId: string;
  currentUserType: UserType;
  onBack?: () => void;
  onViewOrders?: () => void;
}

export function MessageThreadView({
  conversationId,
  currentUserId,
  currentUserType,
  onBack,
  onViewOrders,
}: MessageThreadViewProps) {
  const { data: conversation } = useConversationQuery(conversationId);
  const sendMessage = useSendMessage();

  // Get the other participant (not current user)
  const otherParticipant = conversation?.participants?.find(
    (p: ConversationParticipant) =>
      !(p.user_id === currentUserId && p.user_type === currentUserType)
  );

  const handleSend = async (content: string) => {
    await sendMessage.mutateAsync({
      conversationId,
      content,
    });
  };

  const participantName = otherParticipant?.display_name || 'Unknown';
  const { initials, bgColor } = getAvatarProps(participantName);

  return (
    <div className="flex flex-col h-full flex-1">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3 bg-background">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}

        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={otherParticipant?.avatar_url || undefined} />
          <AvatarFallback className={`${bgColor} text-white`}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{participantName}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {otherParticipant?.user_type || 'User'}
          </p>
        </div>

        {onViewOrders && (
          <Button variant="outline" size="sm" onClick={onViewOrders} className="shrink-0">
            <Package className="w-4 h-4 mr-2" />
            View Orders
          </Button>
        )}
      </div>

      {/* Messages */}
      <MessageThread
        conversationId={conversationId}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
      />

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        disabled={sendMessage.isPending}
      />
    </div>
  );
}
