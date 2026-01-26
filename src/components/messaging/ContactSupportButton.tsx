/**
 * Contact Support Button
 * Opens a new conversation modal pre-populated with Neesh Support
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewConversationModal } from './NewConversationModal';
import type { MessageableUser } from '@/types/messaging';

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supportUser: MessageableUser = {
    id: 'neesh-support',
    user_id: 'neesh-support',
    user_type: 'support',
    display_name: 'Neesh Support',
    avatar_url: null,
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

  const IconComponent = {
    help: HelpCircle,
    message: MessageCircle,
    mail: Mail,
  }[icon];

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setIsModalOpen(true)}>
        <IconComponent className="w-4 h-4 mr-2" />
        {label}
      </Button>

      <NewConversationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onConversationCreated={handleConversationCreated}
        preselectedUser={supportUser}
      />
    </>
  );
}
