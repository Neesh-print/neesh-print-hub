/**
 * Contact Publisher Button
 * Navigates to messages page with publisher pre-selected for new conversation
 */
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonSecondary } from '@/components/neesh';

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

  const handleClick = () => {
    // Navigate to messages with state to trigger new message modal
    const basePath = window.location.pathname.startsWith('/publisher')
      ? '/publisher/messages'
      : '/retailer/messages';

    navigate(basePath, {
      state: {
        newMessage: true,
        recipient: {
          id: publisher.id,
          user_id: publisher.id,
          user_type: 'publisher',
          display_name: publisher.name,
          avatar_url: publisher.logo_url || null,
          city: null,
          state: null,
        },
      },
    });
  };

  return useSecondaryStyle ? (
    <ButtonSecondary
      icon={<MessageCircle className="w-4 h-4" />}
      onClick={handleClick}
    >
      Contact Publisher
    </ButtonSecondary>
  ) : (
    <Button variant={variant} size={size} onClick={handleClick}>
      <MessageCircle className="w-4 h-4 mr-2" />
      Contact Publisher
    </Button>
  );
}
