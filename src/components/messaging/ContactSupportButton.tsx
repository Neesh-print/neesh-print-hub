/**
 * Contact Support Button
 * Navigates to messages page with Neesh Support pre-selected
 */
import { useNavigate } from 'react-router-dom';
import { HelpCircle, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContactSupportButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  icon?: 'help' | 'message' | 'mail';
  label?: string;
}

export function ContactSupportButton({
  variant = 'outline',
  size = 'default',
  icon = 'help',
  label = 'Contact Support',
}: ContactSupportButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    const basePath = window.location.pathname.startsWith('/publisher')
      ? '/publisher/messages'
      : '/retailer/messages';

    navigate(basePath, {
      state: {
        newMessage: true,
        recipient: {
          id: 'neesh-support',
          user_id: 'neesh-support',
          user_type: 'support',
          display_name: 'Neesh Support',
          avatar_url: null,
          city: null,
          state: null,
        },
      },
    });
  };

  const IconComponent = {
    help: HelpCircle,
    message: MessageCircle,
    mail: Mail,
  }[icon];

  return (
    <Button variant={variant} size={size} onClick={handleClick}>
      <IconComponent className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
