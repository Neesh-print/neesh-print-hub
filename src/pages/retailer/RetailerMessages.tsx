import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, 
  Send, 
  MessageSquare, 
  Plus,
  Package,
  Search
} from "lucide-react";
import { RetailerLayout } from "@/components/retailer/RetailerLayout";
import { EmptyState } from "@/components/neesh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  useConversations, 
  useConversation, 
  formatMessageTime,
  formatMessageTimestamp,
  getAvatarProps,
  type Conversation,
} from "@/hooks/useMessages";

// Avatar component for consistent styling
const ConversationAvatar = ({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const { initials, bgColor } = getAvatarProps(name);
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };
  
  return (
    <div className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-medium`}>
      {initials}
    </div>
  );
};

// Conversation list item
const ConversationItem = ({ 
  conversation, 
  isActive, 
  onClick,
  userRole,
}: { 
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  userRole: 'publisher' | 'retailer';
}) => {
  const participant = userRole === 'publisher' ? conversation.retailer : conversation.publisher;
  const hasUnread = conversation.unread_count > 0;
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-4 flex items-center gap-3 text-left transition-colors border-b border-border
        ${isActive ? 'bg-secondary' : 'hover:bg-secondary/50'}
        ${hasUnread ? 'bg-accent/5' : ''}
      `}
    >
      <div className="relative">
        <ConversationAvatar name={participant?.name || 'Unknown'} />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent rounded-full border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${hasUnread ? 'font-semibold' : 'font-medium'} text-foreground`}>
            {participant?.name || 'Unknown'}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {conversation.last_message && formatMessageTime(conversation.last_message.created_at)}
          </span>
        </div>
        <p className={`text-sm truncate ${hasUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
          {conversation.last_message?.content || 'No messages yet'}
        </p>
      </div>
    </button>
  );
};

// Message bubble component
const MessageBubble = ({ 
  content, 
  timestamp, 
  isOwn,
}: { 
  content: string;
  timestamp: string;
  isOwn: boolean;
}) => {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
        <div
          className={`
            inline-block px-4 py-2 rounded-2xl
            ${isOwn 
              ? 'bg-primary text-primary-foreground rounded-br-md' 
              : 'bg-muted text-foreground rounded-bl-md'
            }
          `}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessageTimestamp(timestamp)}
        </p>
      </div>
    </div>
  );
};

// Date separator
const DateSeparator = ({ date }: { date: string }) => (
  <div className="flex items-center justify-center py-4">
    <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
      {date}
    </span>
  </div>
);

// Message input component
const MessageInput = ({ 
  onSend, 
  disabled 
}: { 
  onSend: (content: string) => void;
  disabled?: boolean;
}) => {
  const [value, setValue] = useState('');
  
  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value);
      setValue('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="p-4 border-t border-border bg-background">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-[44px] max-h-32 px-4 py-3 text-sm bg-muted border-0 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted-foreground"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 128) + 'px';
          }}
        />
        <Button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          size="icon"
          className="h-11 w-11 rounded-xl shrink-0"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

// Conversation view (thread)
const ConversationView = ({
  conversation,
  userRole,
  onBack,
  onViewOrders,
}: {
  conversation: Conversation | null;
  userRole: 'publisher' | 'retailer';
  onBack: () => void;
  onViewOrders: () => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { groupedMessages, loading, sendMessage, markAsRead } = useConversation(
    conversation?.id || null,
    userRole
  );
  
  const participant = userRole === 'publisher' ? conversation?.retailer : conversation?.publisher;
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupedMessages]);
  
  // Mark as read when opening
  useEffect(() => {
    if (conversation?.id && conversation.unread_count > 0) {
      markAsRead();
    }
  }, [conversation?.id, conversation?.unread_count, markAsRead]);
  
  if (!conversation) return null;
  
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-background">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <ConversationAvatar name={participant?.name || 'Unknown'} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{participant?.name}</p>
          <p className="text-sm text-muted-foreground truncate">{participant?.location}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onViewOrders} className="shrink-0">
          <Package className="w-4 h-4 mr-2" />
          View Orders
        </Button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground">Start the conversation!</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <DateSeparator date={group.date} />
              <div className="space-y-3">
                {group.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    content={message.content}
                    timestamp={message.created_at}
                    isOwn={message.sender_role === userRole}
                  />
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <MessageInput onSend={sendMessage} />
    </div>
  );
};

// New message drawer for selecting a contact
const NewMessageDrawer = ({
  isOpen,
  onClose,
  userRole,
  onSelectContact,
}: {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'publisher' | 'retailer';
  onSelectContact: (contactId: string) => void;
}) => {
  const [search, setSearch] = useState('');
  
  // Mock eligible contacts (publishers they've ordered from)
  const eligibleContacts = [
    { id: 'pub-1', name: 'Wax Poetics', location: 'Brooklyn, NY', lastOrder: 'Jan 15, 2026' },
    { id: 'pub-2', name: 'Kinfolk', location: 'Copenhagen, Denmark', lastOrder: 'Jan 12, 2026' },
    { id: 'pub-3', name: 'Drift', location: 'Los Angeles, CA', lastOrder: 'Jan 5, 2026' },
    { id: 'pub-4', name: 'Apartamento', location: 'Barcelona, Spain', lastOrder: 'Dec 20, 2025' },
  ];
  
  const filteredContacts = eligibleContacts.filter(contact =>
    contact.name.toLowerCase().includes(search.toLowerCase()) ||
    contact.location.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>New Message</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search publishers..."
              className="pl-10"
            />
          </div>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No contacts found
              </p>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => {
                    onSelectContact(contact.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <ConversationAvatar name={contact.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{contact.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{contact.location}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Last order: {contact.lastOrder}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// Main component
export const RetailerMessages = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, loading } = useConversations('retailer');
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get('conversation')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  
  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const name = conv.publisher?.name?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase());
  });
  
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setSearchParams({ conversation: id });
  };
  
  const handleBack = () => {
    setSelectedConversationId(null);
    setSearchParams({});
  };
  
  const handleViewOrders = () => {
    // Navigate to orders filtered by this publisher
    navigate('/retailer/orders');
  };
  
  const handleNewMessage = (contactId: string) => {
    // In a real app, this would create or find an existing conversation
    // For now, just select the first conversation as a demo
    if (conversations.length > 0) {
      handleSelectConversation(conversations[0].id);
    }
  };
  
  // On mobile, show either list or conversation
  const showConversation = selectedConversationId && (isMobile || true);
  const showList = !isMobile || !selectedConversationId;
  
  return (
    <RetailerLayout>
      <div className="h-[calc(100vh-56px)] md:h-screen flex">
        {/* Conversation List */}
        {showList && (
          <div className={`
            ${isMobile && selectedConversationId ? 'hidden' : 'flex'} 
            flex-col w-full md:w-80 lg:w-96 border-r border-border bg-background
          `}>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Messages</h1>
                  <p className="text-sm text-muted-foreground">Conversations with publishers</p>
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsNewMessageOpen(true)}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading conversations...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={<MessageSquare className="w-12 h-12" />}
                    title="No messages yet"
                    description="After placing an order, you can message publishers directly to ask questions or provide feedback."
                  />
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === selectedConversationId}
                    onClick={() => handleSelectConversation(conversation.id)}
                    userRole="retailer"
                  />
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Conversation View */}
        {showConversation && selectedConversation ? (
          <ConversationView
            conversation={selectedConversation}
            userRole="retailer"
            onBack={handleBack}
            onViewOrders={handleViewOrders}
          />
        ) : !isMobile && (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
      
      {/* New Message Drawer */}
      <NewMessageDrawer
        isOpen={isNewMessageOpen}
        onClose={() => setIsNewMessageOpen(false)}
        userRole="retailer"
        onSelectContact={handleNewMessage}
      />
    </RetailerLayout>
  );
};

export default RetailerMessages;
