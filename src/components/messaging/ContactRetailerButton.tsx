/**
 * Contact Retailer Button
 * Opens a new conversation modal pre-populated with a retailer
 * Used for retailer-to-retailer or publisher-to-retailer messaging
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewConversationModal } from './NewConversationModal';
import { useCurrentMessagingUser } from '@/hooks/useConversationsQuery';
import type { MessageableUser } from '@/types/messaging';

interface ContactRetailerButtonProps {
  retailer: {
    id: string;
    user_id: string;
    store_name: string;
    profile_image_url?: string | null;
    city?: string | null;
    state?: string | null;
  };
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function ContactRetailerButton({
  retailer,
  variant = 'outline',
  size = 'default',
}: ContactRetailerButtonProps) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const currentUser = useCurrentMessagingUser();

  // Don't show button on own profile
  if (
    currentUser?.id === retailer.user_id &&
    currentUser?.type === 'retailer'
  ) {
    return null;
  }

  const preselectedUser: MessageableUser = {
    id: retailer.id,
    user_id: retailer.user_id,
    user_type: 'retailer',
    display_name: retailer.store_name,
    avatar_url: retailer.profile_image_url || null,
    city: retailer.city || null,
    state: retailer.state || null,
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
      <Button variant={variant} size={size} onClick={() => setIsModalOpen(true)}>
        <MessageCircle className="w-4 h-4 mr-2" />
        Send Message
      </Button>

      <NewConversationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onConversationCreated={handleConversationCreated}
        preselectedUser={preselectedUser}
      />
    </>
  );
}
