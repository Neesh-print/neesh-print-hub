import { Skeleton } from '@/components/ui/skeleton';

export function ConversationListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 border-b border-border">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
