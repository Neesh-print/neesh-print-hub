/**
 * Contact Publisher Button
 * Opens a new conversation modal pre-populated with the publisher
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonSecondary } from '@/components/neesh';
import { NewConversationModal } from './NewConversationModal';
import type { MessageableUser } from '@/types/messaging';

interface ContactPublisherButtonProps {
  publisher: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  /** Use ButtonSecondary style instead of Button */
  useSecondaryStyle?: boolean;
}

export function ContactPublisherButton({
  publisher,
  variant = 'outline',
  size = 'default',
  useSecondaryStyle = false,
}: ContactPublisherButtonProps) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const preselectedUser: MessageableUser = {
    id: publisher.id,
    user_id: publisher.id,
    user_type: 'publisher',
    display_name: publisher.name,
    avatar_url: publisher.logo_url || null,
    city: null,
    state: null,
  };

  const handleConversationCreated = (conversationId: string) => {
    // Navigate to retailer or publisher messages based on current path
    const basePath = window.location.pathname.startsWith('/publisher')
      ? '/publisher/messages'
      : '/retailer/messages';
    navigate(`${basePath}/${conversationId}`);
  };

  return (
    <>
      {useSecondaryStyle ? (
        <ButtonSecondary
          icon={<MessageCircle className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          Contact Publisher
        </ButtonSecondary>
      ) : (
        <Button variant={variant} size={size} onClick={() => setIsModalOpen(true)}>
          <MessageCircle className="w-4 h-4 mr-2" />
          Contact Publisher
        </Button>
      )}

      <NewConversationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onConversationCreated={handleConversationCreated}
        preselectedUser={preselectedUser}
      />
    </>
  );
}
