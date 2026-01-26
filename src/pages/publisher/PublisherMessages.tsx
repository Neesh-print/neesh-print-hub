import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PublisherLayout } from '@/components/publisher/PublisherLayout';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ConversationList,
  MessagesHeader,
  EmptyConversationState,
  MessageThreadView,
} from '@/components/messaging';
import {
  useConversationsQuery,
  useCurrentMessagingUser,
} from '@/hooks/useConversationsQuery';
import { getAvatarProps } from '@/lib/messaging';

// Avatar component for contact selection
const ContactAvatar = ({ name }: { name: string }) => {
  const { initials, bgColor } = getAvatarProps(name);
  return (
    <div className={`w-10 h-10 ${bgColor} rounded-full flex items-center justify-center text-white font-medium text-sm`}>
      {initials}
    </div>
  );
};

// New message drawer for selecting a contact
const NewMessageDrawer = ({
  isOpen,
  onClose,
  onSelectContact,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
}) => {
  const [search, setSearch] = useState('');

  // Mock eligible contacts (retailers they've transacted with)
  const eligibleContacts = [
    { id: 'ret-1', name: 'McNally Jackson', location: 'New York, NY', lastOrder: 'Jan 15, 2026' },
    { id: 'ret-2', name: 'Spoonbill & Sugartown', location: 'Brooklyn, NY', lastOrder: 'Jan 12, 2026' },
    { id: 'ret-3', name: 'Commonplace Books', location: 'Denver, CO', lastOrder: 'Jan 10, 2026' },
    { id: 'ret-4', name: 'Book Culture', location: 'New York, NY', lastOrder: 'Jan 8, 2026' },
  ];

  const filteredContacts = eligibleContacts.filter(
    (contact) =>
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
              placeholder="Search retailers..."
              className="pl-10"
            />
          </div>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No contacts found</p>
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
                  <ContactAvatar name={contact.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{contact.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{contact.location}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Last order: {contact.lastOrder}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export const PublisherMessages = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useCurrentMessagingUser();
  const { data: conversations = [], isLoading } = useConversationsQuery();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get('conversation')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);

  // Filter conversations by other participant's name
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const name = conv.otherParticipant?.display_name?.toLowerCase() || '';
      return name.includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setSearchParams({ conversation: id });
  };

  const handleBack = () => {
    setSelectedConversationId(null);
    setSearchParams({});
  };

  const handleViewOrders = () => {
    navigate('/publisher/orders');
  };

  const handleNewMessage = (contactId: string) => {
    // In a real app, this would create or find an existing conversation
    if (conversations.length > 0) {
      handleSelectConversation(conversations[0].id);
    }
  };

  // On mobile, show either list or conversation
  const showConversation = !!selectedConversationId;
  const showList = !isMobile || !selectedConversationId;

  return (
    <PublisherLayout>
      <div className="h-[calc(100vh-56px)] md:h-screen flex">
        {/* Conversation List */}
        {showList && (
          <div
            className={`
              ${isMobile && selectedConversationId ? 'hidden' : 'flex'} 
              flex-col w-full md:w-80 lg:w-96 border-r border-border bg-background
            `}
          >
            <MessagesHeader
              title="Messages"
              subtitle="Conversations with your retailers"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNewMessage={() => setIsNewMessageOpen(true)}
              searchPlaceholder="Search conversations..."
            />

            {currentUser && (
              <ConversationList
                conversations={filteredConversations}
                selectedId={selectedConversationId}
                currentUserId={currentUser.id}
                currentUserType={currentUser.type}
                isLoading={isLoading}
                onSelect={handleSelectConversation}
              />
            )}
          </div>
        )}

        {/* Conversation View */}
        {showConversation && currentUser ? (
          <MessageThreadView
            conversationId={selectedConversationId!}
            currentUserId={currentUser.id}
            currentUserType={currentUser.type}
            onBack={handleBack}
            onViewOrders={handleViewOrders}
          />
        ) : (
          !isMobile && <EmptyConversationState />
        )}
      </div>

      {/* New Message Drawer */}
      <NewMessageDrawer
        isOpen={isNewMessageOpen}
        onClose={() => setIsNewMessageOpen(false)}
        onSelectContact={handleNewMessage}
      />
    </PublisherLayout>
  );
};

export default PublisherMessages;
