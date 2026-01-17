import { Skeleton } from "@/components/ui/skeleton";

export function MagazineCardSkeleton() {
  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border">
      {/* Cover image placeholder */}
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />
        {/* Publisher */}
        <Skeleton className="h-4 w-1/2" />
        {/* Price or tags */}
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    </div>
  );
}

export function MagazineGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <MagazineCardSkeleton key={i} />
      ))}
    </div>
  );
}
