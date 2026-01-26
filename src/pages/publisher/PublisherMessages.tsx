import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PublisherLayout } from '@/components/publisher/PublisherLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ConversationList,
  MessagesHeader,
  EmptyConversationState,
  MessageThreadView,
  NewConversationModal,
} from '@/components/messaging';
import {
  useConversationsQuery,
  useCurrentMessagingUser,
} from '@/hooks/useConversationsQuery';

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

  const handleNewConversation = (conversationId: string) => {
    setIsNewMessageOpen(false);
    handleSelectConversation(conversationId);
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

      {/* New Message Modal */}
      <NewConversationModal
        open={isNewMessageOpen}
        onOpenChange={setIsNewMessageOpen}
        onConversationCreated={handleNewConversation}
      />
    </PublisherLayout>
  );
};

export default PublisherMessages;
