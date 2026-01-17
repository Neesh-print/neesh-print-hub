import { Skeleton } from "@/components/ui/skeleton";

export function MetricCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      {/* Label */}
      <Skeleton className="h-4 w-24" />
      {/* Value */}
      <Skeleton className="h-8 w-20" />
      {/* Trend */}
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function DashboardMetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${height}`}>
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-full w-full rounded" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <DashboardMetricsSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
