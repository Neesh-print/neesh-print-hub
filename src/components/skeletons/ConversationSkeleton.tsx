import { Skeleton } from "@/components/ui/skeleton";

export function ConversationItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border">
      {/* Avatar */}
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        {/* Name */}
        <Skeleton className="h-4 w-32" />
        {/* Last message preview */}
        <Skeleton className="h-3 w-48" />
      </div>
      {/* Timestamp */}
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <ConversationItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function MessageBubbleSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] space-y-2 ${isOwn ? 'items-end' : 'items-start'}`}>
        <Skeleton className={`h-16 w-48 rounded-2xl ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'}`} />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <MessageBubbleSkeleton isOwn={false} />
      <MessageBubbleSkeleton isOwn={true} />
      <MessageBubbleSkeleton isOwn={false} />
      <MessageBubbleSkeleton isOwn={true} />
    </div>
  );
}
