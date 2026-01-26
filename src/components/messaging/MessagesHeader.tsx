import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MessagesHeaderProps {
  title?: string;
  subtitle?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewMessage: () => void;
  searchPlaceholder?: string;
}

export function MessagesHeader({
  title = 'Messages',
  subtitle,
  searchQuery,
  onSearchChange,
  onNewMessage,
  searchPlaceholder = 'Search conversations...',
}: MessagesHeaderProps) {
  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={onNewMessage}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-10"
        />
      </div>
    </div>
  );
}
