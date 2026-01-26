/**
 * Messaging Utility Functions
 * Helpers for formatting, grouping, and display logic.
 */

import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import type { Message, MessageGroup, AvatarProps } from '@/types/messaging';

/**
 * Format a date string as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format a date string as message timestamp (e.g., "2:30 PM")
 */
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return format(date, 'h:mm a');
}

/**
 * Format a date string as a label for date separators
 */
export function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

/**
 * Format a short relative time for conversation list (e.g., "2h", "Yesterday")
 */
export function formatConversationTime(dateString: string | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  
  return format(date, 'MMM d');
}

/**
 * Group messages by date for rendering with date separators
 */
export function groupMessagesByDate(messages: Message[]): MessageGroup[] {
  const groups: Map<string, Message[]> = new Map();
  
  // Sort messages by created_at ascending
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  sortedMessages.forEach((message) => {
    const dateKey = format(new Date(message.created_at), 'yyyy-MM-dd');
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, message]);
  });
  
  return Array.from(groups.entries()).map(([date, msgs]) => ({
    date,
    dateLabel: formatDateLabel(msgs[0].created_at),
    messages: msgs,
  }));
}

/**
 * Generate avatar initials and consistent background color from a name
 */
export function getAvatarProps(name: string | null): AvatarProps {
  if (!name) {
    return { initials: '?', bgColor: 'bg-muted' };
  }

  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate consistent color based on name hash
  const colors = [
    'bg-rose-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bgColor = colors[Math.abs(hash) % colors.length];
  
  return { initials, bgColor };
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string | null, maxLength: number = 100): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

/**
 * Get location string from city and state
 */
export function formatLocation(city: string | null, state: string | null): string {
  if (city && state) return `${city}, ${state}`;
  return city || state || '';
}

/**
 * Check if a message is from the current user
 */
export function isOwnMessage(message: Message, currentUserId: string): boolean {
  return message.sender_id === currentUserId;
}

/**
 * Generate a unique optimistic message ID
 */
export function generateOptimisticId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
