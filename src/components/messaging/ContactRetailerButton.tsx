/**
 * Contact Retailer Button
 * Navigates to messages page with retailer pre-selected
 * Used for retailer-to-retailer or publisher-to-retailer messaging
 */
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentMessagingUser } from '@/hooks/useConversationsQuery';

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
  const currentUser = useCurrentMessagingUser();

  // Don't show button on own profile
  if (
    currentUser?.id === retailer.user_id &&
    currentUser?.type === 'retailer'
  ) {
    return null;
  }

  const handleClick = () => {
    const basePath = window.location.pathname.startsWith('/publisher')
      ? '/publisher/messages'
      : '/retailer/messages';

    navigate(basePath, {
      state: {
        newMessage: true,
        recipient: {
          id: retailer.id,
          user_id: retailer.user_id,
          user_type: 'retailer',
          display_name: retailer.store_name,
          avatar_url: retailer.profile_image_url || null,
          city: retailer.city || null,
          state: retailer.state || null,
        },
      },
    });
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick}>
      <MessageCircle className="w-4 h-4 mr-2" />
      Send Message
    </Button>
  );
}
