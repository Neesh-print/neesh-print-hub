import { Skeleton } from "@/components/ui/skeleton";

export function OrderCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        {/* Order number */}
        <Skeleton className="h-5 w-24" />
        {/* Status badge */}
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Date and items count */}
      <Skeleton className="h-4 w-40" />

      {/* Item preview */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-16 w-12 rounded" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Total */}
      <Skeleton className="h-5 w-16 ml-auto" />
    </div>
  );
}

export function OrderListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}
