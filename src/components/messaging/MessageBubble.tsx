/**
 * Message Bubble Component
 * Individual message display with sender info and timestamp
 */

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatMessageTime, getAvatarProps } from '@/lib/messaging';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/messaging';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSenderInfo?: boolean;
}

export function MessageBubble({ message, isOwn, showSenderInfo = true }: MessageBubbleProps) {
  const senderName = message.sender?.display_name || 'Unknown';
  const { initials, bgColor } = getAvatarProps(senderName);

  return (
    <div
      className={cn(
        'flex gap-2 max-w-[80%]',
        isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      {/* Avatar for other user's messages */}
      {!isOwn && showSenderInfo && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className={cn(bgColor, 'text-white text-xs')}>
            {initials}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted rounded-bl-sm'
          )}
        >
          {/* Sender name for other users */}
          {!isOwn && showSenderInfo && message.sender && (
            <p className="text-xs font-medium mb-1 opacity-70">
              {message.sender.display_name}
            </p>
          )}

          {/* Message content */}
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Timestamp */}
        <p
          className={cn(
            'text-xs mt-1',
            isOwn ? 'text-muted-foreground' : 'text-muted-foreground'
          )}
        >
          {formatMessageTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
