import { MessageSquare } from 'lucide-react';

interface EmptyConversationStateProps {
  title?: string;
  description?: string;
}

export function EmptyConversationState({
  title = 'Select a conversation',
  description = 'Choose a conversation from the sidebar or start a new one.',
}: EmptyConversationStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <MessageSquare className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
