/**
 * User Search Component
 * Searches messageable_users view for retailers, publishers, and support
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { getAvatarProps, formatLocation } from '@/lib/messaging';
import type { MessageableUser, UserType } from '@/types/messaging';

interface UserSearchProps {
  onSelect: (user: MessageableUser) => void;
  excludeIds?: string[];
  placeholder?: string;
}

// Neesh Support static user
const NEESH_SUPPORT: MessageableUser = {
  id: '00000000-0000-0000-0000-000000000000',
  user_id: '00000000-0000-0000-0000-000000000000',
  user_type: 'support',
  display_name: 'Neesh Support',
  avatar_url: null,
  city: null,
  state: null,
};

export function UserSearch({
  onSelect,
  excludeIds = [],
  placeholder = 'Search users...',
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: async (): Promise<MessageableUser[]> => {
      if (debouncedQuery.length < 2) return [];

      const { data, error } = await supabase
        .from('messageable_users')
        .select('*')
        .or(
          `display_name.ilike.%${debouncedQuery}%,city.ilike.%${debouncedQuery}%`
        )
        .limit(10);

      if (error) throw error;

      // Filter out excluded users and map to proper type
      let filtered: MessageableUser[] = (data || [])
        .filter((user) => !excludeIds.includes(user.id || ''))
        .map((user) => ({
          id: user.id || '',
          user_id: user.user_id || '',
          user_type: (user.user_type as UserType) || 'retailer',
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          city: user.city,
          state: user.state,
        }));

      // Always include Neesh Support for relevant queries
      const supportTerms = ['neesh', 'support', 'help'];
      const includeSupport = supportTerms.some((term) =>
        debouncedQuery.toLowerCase().includes(term)
      );

      if (includeSupport && !excludeIds.includes(NEESH_SUPPORT.id)) {
        filtered = [NEESH_SUPPORT, ...filtered];
      }

      return filtered;
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userTypeLabels: Record<UserType, string> = {
    retailer: 'Retailer',
    publisher: 'Publisher',
    support: 'Support',
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No users found
            </div>
          ) : (
            results?.map((user) => {
              const { initials, bgColor } = getAvatarProps(user.display_name);
              const location = formatLocation(user.city, user.state);

              return (
                <button
                  key={`${user.user_type}-${user.id}`}
                  onClick={() => {
                    onSelect(user);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="w-full p-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className={`${bgColor} text-white`}>
                      {user.user_type === 'support' ? '?' : initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {user.display_name || 'Unknown'}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {userTypeLabels[user.user_type]}
                      </Badge>
                    </div>
                    {location && (
                      <span className="text-xs text-muted-foreground">
                        {location}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
