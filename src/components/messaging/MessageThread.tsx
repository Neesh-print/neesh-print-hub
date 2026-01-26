/**
 * Message Thread Component
 * Displays messages grouped by date with auto-scroll
 */

import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ChatSkeleton } from '@/components/skeletons/ConversationSkeleton';
import { useMessagesQuery, useMarkConversationAsRead } from '@/hooks/useMessagesQuery';
import { groupMessagesByDate } from '@/lib/messaging';
import type { UserType } from '@/types/messaging';

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  currentUserType: UserType;
}

export function MessageThread({
  conversationId,
  currentUserId,
  currentUserType,
}: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading } = useMessagesQuery(conversationId);

  // Mark conversation as read when viewing
  useMarkConversationAsRead(conversationId);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages?.length]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <ChatSkeleton />
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No messages yet</p>
          <p className="text-sm">Send a message to start the conversation</p>
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {group.dateLabel}
            </span>
          </div>

          {/* Messages for this date */}
          <div className="space-y-3">
            {group.messages.map((message) => {
              const isOwn =
                message.sender_id === currentUserId &&
                message.sender_type === currentUserType;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={isOwn}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
