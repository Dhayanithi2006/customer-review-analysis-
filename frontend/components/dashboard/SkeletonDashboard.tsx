import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonDashboard() {
  return (
    <div className="animate-fade-in">
      {/* AI Banner skeleton */}
      <Skeleton className="h-16 w-full rounded-2xl mb-6" />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-5">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <Skeleton className="h-14 w-full rounded-2xl mb-6" />

      {/* Filter tabs skeleton */}
      <div className="flex gap-2 mb-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Priority items */}
      <div className="flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-surface">
            <Skeleton className="h-4 w-6 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-12 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
