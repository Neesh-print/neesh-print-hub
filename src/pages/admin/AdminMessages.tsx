import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { AdminLayout } from '@/components/admin';
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
import type { MessageableUser } from '@/types/messaging';

export const AdminMessages = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useCurrentMessagingUser();
  const { data: conversations = [], isLoading } = useConversationsQuery();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get('conversation')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [preselectedUser, setPreselectedUser] = useState<MessageableUser | null>(null);

  // Handle incoming navigation state (from Contact buttons)
  const incomingState = location.state as {
    newMessage?: boolean;
    recipient?: MessageableUser;
  } | null;

  useEffect(() => {
    if (incomingState?.newMessage) {
      setPreselectedUser(incomingState.recipient || null);
      setIsNewMessageOpen(true);

      // Clear the state so refreshing doesn't reopen modal
      navigate('/admin/messages', { replace: true, state: null });
    }
  }, [incomingState, navigate]);

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
    navigate('/admin/orders');
  };

  const handleNewConversation = (conversationId: string) => {
    setIsNewMessageOpen(false);
    setPreselectedUser(null);
    handleSelectConversation(conversationId);
  };

  const handleNewMessageClick = () => {
    setPreselectedUser(null);
    setIsNewMessageOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setIsNewMessageOpen(open);
    if (!open) {
      setPreselectedUser(null);
    }
  };

  // On mobile, show either list or conversation
  const showConversation = !!selectedConversationId;
  const showList = !isMobile || !selectedConversationId;

  return (
    <AdminLayout>
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
              subtitle="Conversations with publishers & retailers"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNewMessage={handleNewMessageClick}
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
        onOpenChange={handleModalClose}
        onConversationCreated={handleNewConversation}
        preselectedUser={preselectedUser}
      />
    </AdminLayout>
  );
};

export default AdminMessages;
