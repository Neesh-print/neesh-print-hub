/**
 * New Conversation Modal
 * Allows users to search for and start a conversation with any user
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserSearch } from './UserSearch';
import { useGetOrCreateConversation } from '@/hooks/useGetOrCreateConversation';
import { useSendMessage } from '@/hooks/useMessagesQuery';
import { useCurrentMessagingUser } from '@/hooks/useConversationsQuery';
import { getAvatarProps, formatLocation } from '@/lib/messaging';
import type { MessageableUser } from '@/types/messaging';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
  preselectedUser?: MessageableUser | null;
}

export function NewConversationModal({
  open,
  onOpenChange,
  onConversationCreated,
  preselectedUser = null,
}: NewConversationModalProps) {
  const [selectedUser, setSelectedUser] = useState<MessageableUser | null>(
    preselectedUser
  );
  const [message, setMessage] = useState('');
  const currentUser = useCurrentMessagingUser();
  const getOrCreateConversation = useGetOrCreateConversation();
  const sendMessage = useSendMessage();

  // Update selected user when preselectedUser changes
  useEffect(() => {
    if (preselectedUser) {
      setSelectedUser(preselectedUser);
    }
  }, [preselectedUser]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      if (!preselectedUser) {
        setSelectedUser(null);
      }
      setMessage('');
    }
  }, [open, preselectedUser]);

  const handleSend = async () => {
    if (!selectedUser || !message.trim() || !currentUser) return;

    try {
      // Get or create conversation
      const conversationId = await getOrCreateConversation.mutateAsync({
        userId: selectedUser.user_id,
        userType: selectedUser.user_type,
        displayName: selectedUser.display_name || undefined,
        avatarUrl: selectedUser.avatar_url,
      });

      // Send the message
      await sendMessage.mutateAsync({
        conversationId,
        content: message.trim(),
      });

      onConversationCreated(conversationId);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error('Failed to start conversation');
    }
  };

  const isLoading =
    getOrCreateConversation.isPending || sendMessage.isPending;

  // Exclude current user from search
  const excludeIds = currentUser ? [currentUser.id] : [];

  const selectedUserAvatar = selectedUser
    ? getAvatarProps(selectedUser.display_name)
    : null;
  const selectedUserLocation = selectedUser
    ? formatLocation(selectedUser.city, selectedUser.state)
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Start a conversation with any retailer, publisher, or Neesh Support.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient selection */}
          {!selectedUser ? (
            <div className="space-y-2">
              <Label>To</Label>
              <UserSearch
                onSelect={setSelectedUser}
                excludeIds={excludeIds}
                placeholder="Search for a retailer, publisher, or support..."
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback
                    className={`${selectedUserAvatar?.bgColor} text-white`}
                  >
                    {selectedUser.user_type === 'support'
                      ? '?'
                      : selectedUserAvatar?.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedUser.display_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedUser.user_type}
                    {selectedUserLocation && ` · ${selectedUserLocation}`}
                  </p>
                </div>
              </div>
              {!preselectedUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  Change
                </Button>
              )}
            </div>
          )}

          {/* Message input */}
          {selectedUser && (
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedUser || !message.trim() || isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
