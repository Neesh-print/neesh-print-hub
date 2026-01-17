import { useState, useEffect, useCallback } from 'react';

// Types
export interface ConversationParticipant {
  id: string;
  name: string;
  location?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'publisher' | 'retailer';
  content: string;
  created_at: string;
  read_at?: string;
}

export interface Conversation {
  id: string;
  publisher_id: string;
  retailer_id: string;
  created_at: string;
  updated_at: string;
  publisher?: ConversationParticipant;
  retailer?: ConversationParticipant;
  last_message?: Message;
  unread_count: number;
}

// Mock Data
const MOCK_CONVERSATIONS_PUBLISHER: Conversation[] = [
  {
    id: 'conv-1',
    publisher_id: 'pub-1',
    retailer_id: 'ret-1',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-17T14:30:00Z',
    retailer: {
      id: 'ret-1',
      name: 'McNally Jackson',
      location: 'New York, NY',
    },
    last_message: {
      id: 'msg-3',
      conversation_id: 'conv-1',
      sender_id: 'ret-1',
      sender_role: 'retailer',
      content: 'Thanks! We sold out of Issue 75 already. Can we reorder?',
      created_at: '2026-01-17T14:30:00Z',
    },
    unread_count: 1,
  },
  {
    id: 'conv-2',
    publisher_id: 'pub-1',
    retailer_id: 'ret-2',
    created_at: '2026-01-08T10:00:00Z',
    updated_at: '2026-01-16T10:15:00Z',
    retailer: {
      id: 'ret-2',
      name: 'Spoonbill & Sugartown',
      location: 'Brooklyn, NY',
    },
    last_message: {
      id: 'msg-6',
      conversation_id: 'conv-2',
      sender_id: 'pub-1',
      sender_role: 'publisher',
      content: 'Shipped today! Tracking number is 1Z999AA10123456784',
      created_at: '2026-01-16T10:15:00Z',
    },
    unread_count: 0,
  },
  {
    id: 'conv-3',
    publisher_id: 'pub-1',
    retailer_id: 'ret-3',
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-01-14T09:00:00Z',
    retailer: {
      id: 'ret-3',
      name: 'Commonplace Books',
      location: 'Denver, CO',
    },
    last_message: {
      id: 'msg-9',
      conversation_id: 'conv-3',
      sender_id: 'ret-3',
      sender_role: 'retailer',
      content: 'Do you have any display stands available for purchase?',
      created_at: '2026-01-14T09:00:00Z',
    },
    unread_count: 1,
  },
];

const MOCK_CONVERSATIONS_RETAILER: Conversation[] = [
  {
    id: 'conv-1',
    publisher_id: 'pub-1',
    retailer_id: 'ret-1',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-17T14:30:00Z',
    publisher: {
      id: 'pub-1',
      name: 'Wax Poetics',
      location: 'Brooklyn, NY',
    },
    last_message: {
      id: 'msg-3',
      conversation_id: 'conv-1',
      sender_id: 'ret-1',
      sender_role: 'retailer',
      content: 'Thanks! We sold out of Issue 75 already. Can we reorder?',
      created_at: '2026-01-17T14:30:00Z',
    },
    unread_count: 0,
  },
  {
    id: 'conv-4',
    publisher_id: 'pub-2',
    retailer_id: 'ret-1',
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-16T16:00:00Z',
    publisher: {
      id: 'pub-2',
      name: 'Kinfolk',
      location: 'Copenhagen, Denmark',
    },
    last_message: {
      id: 'msg-10',
      conversation_id: 'conv-4',
      sender_id: 'pub-2',
      sender_role: 'publisher',
      content: 'Great to hear! Issue 46 is coming out next month, I\'ll keep you posted.',
      created_at: '2026-01-16T16:00:00Z',
    },
    unread_count: 1,
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversation_id: 'conv-1',
      sender_id: 'ret-1',
      sender_role: 'retailer',
      content: 'Hi! We just received our first order. The magazines look great!',
      created_at: '2026-01-15T10:00:00Z',
    },
    {
      id: 'msg-2',
      conversation_id: 'conv-1',
      sender_id: 'pub-1',
      sender_role: 'publisher',
      content: 'So glad to hear it! Let me know how they sell. Happy to answer any questions about display or pricing.',
      created_at: '2026-01-15T11:30:00Z',
    },
    {
      id: 'msg-3',
      conversation_id: 'conv-1',
      sender_id: 'ret-1',
      sender_role: 'retailer',
      content: 'Thanks! We sold out of Issue 75 already. Can we reorder?',
      created_at: '2026-01-17T14:30:00Z',
    },
  ],
  'conv-2': [
    {
      id: 'msg-4',
      conversation_id: 'conv-2',
      sender_id: 'ret-2',
      sender_role: 'retailer',
      content: 'When can we expect our order to ship?',
      created_at: '2026-01-16T09:00:00Z',
    },
    {
      id: 'msg-5',
      conversation_id: 'conv-2',
      sender_id: 'pub-1',
      sender_role: 'publisher',
      content: 'Hi! I\'ll be shipping your order today.',
      created_at: '2026-01-16T10:00:00Z',
    },
    {
      id: 'msg-6',
      conversation_id: 'conv-2',
      sender_id: 'pub-1',
      sender_role: 'publisher',
      content: 'Shipped today! Tracking number is 1Z999AA10123456784',
      created_at: '2026-01-16T10:15:00Z',
    },
  ],
  'conv-3': [
    {
      id: 'msg-7',
      conversation_id: 'conv-3',
      sender_id: 'ret-3',
      sender_role: 'retailer',
      content: 'Love the new issue! Our customers are really responding well.',
      created_at: '2026-01-13T14:00:00Z',
    },
    {
      id: 'msg-8',
      conversation_id: 'conv-3',
      sender_id: 'pub-1',
      sender_role: 'publisher',
      content: 'That\'s wonderful to hear! Thanks for the feedback.',
      created_at: '2026-01-13T15:00:00Z',
    },
    {
      id: 'msg-9',
      conversation_id: 'conv-3',
      sender_id: 'ret-3',
      sender_role: 'retailer',
      content: 'Do you have any display stands available for purchase?',
      created_at: '2026-01-14T09:00:00Z',
    },
  ],
  'conv-4': [
    {
      id: 'msg-10',
      conversation_id: 'conv-4',
      sender_id: 'pub-2',
      sender_role: 'publisher',
      content: 'Great to hear! Issue 46 is coming out next month, I\'ll keep you posted.',
      created_at: '2026-01-16T16:00:00Z',
    },
  ],
};

const STORAGE_KEY = 'neesh_messages';

// Utility to format relative time
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMessageTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

export function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// Group messages by date
export function groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
  const groups: Record<string, Message[]> = {};
  
  messages.forEach(message => {
    const dateKey = new Date(message.created_at).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
  });
  
  return Object.entries(groups).map(([dateKey, msgs]) => ({
    date: formatMessageDate(msgs[0].created_at),
    messages: msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  }));
}

// Get initials and color from name
export function getAvatarProps(name: string): { initials: string; bgColor: string } {
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

// Hook for managing conversations
export function useConversations(userRole: 'publisher' | 'retailer') {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading from localStorage or mock data
    const loadConversations = () => {
      setLoading(true);
      
      // TODO: Replace with Supabase query
      // const { data } = await supabase
      //   .from('conversations')
      //   .select('*, publisher:publishers(*), retailer:retailers(*), last_message:messages(*)');
      
      setTimeout(() => {
        const mockData = userRole === 'publisher' 
          ? MOCK_CONVERSATIONS_PUBLISHER 
          : MOCK_CONVERSATIONS_RETAILER;
        setConversations(mockData);
        setLoading(false);
      }, 300);
    };

    loadConversations();
  }, [userRole]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const getConversation = (id: string) => conversations.find(c => c.id === id);

  return { 
    conversations, 
    loading, 
    totalUnread,
    getConversation,
  };
}

// Hook for managing a single conversation's messages
export function useConversation(conversationId: string | null, userRole: 'publisher' | 'retailer') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Simulate loading messages
    setLoading(true);
    
    // TODO: Replace with Supabase query
    // const { data } = await supabase
    //   .from('messages')
    //   .select('*')
    //   .eq('conversation_id', conversationId)
    //   .order('created_at', { ascending: true });
    
    setTimeout(() => {
      const mockMessages = MOCK_MESSAGES[conversationId] || [];
      setMessages(mockMessages);
      setLoading(false);
    }, 200);
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !content.trim()) return;
    
    setSending(true);
    
    // Create optimistic message
    const newMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: userRole === 'publisher' ? 'pub-1' : 'ret-1',
      sender_role: userRole,
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    
    // Add to local state immediately
    setMessages(prev => [...prev, newMessage]);
    
    // TODO: Send to Supabase
    // await supabase.from('messages').insert({
    //   conversation_id: conversationId,
    //   sender_id: userId,
    //   sender_role: userRole,
    //   content: content.trim(),
    // });
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSending(false);
  }, [conversationId, userRole]);

  const markAsRead = useCallback(async () => {
    if (!conversationId) return;
    
    // TODO: Update read_at for all unread messages in conversation
    // await supabase
    //   .from('messages')
    //   .update({ read_at: new Date().toISOString() })
    //   .eq('conversation_id', conversationId)
    //   .is('read_at', null);
  }, [conversationId]);

  return { 
    messages, 
    loading, 
    sending,
    sendMessage, 
    markAsRead,
    groupedMessages: groupMessagesByDate(messages),
  };
}

// TODO: Real-time message updates via Supabase subscriptions
// TODO: Typing indicators
// TODO: Read receipts (show when message was read)
// TODO: Image/file attachments
// TODO: Message reactions (quick emoji responses)
// TODO: Canned responses / quick replies for common messages
// TODO: Admin view to moderate reported conversations
// TODO: Archive/mute conversation
// TODO: Search within conversation
