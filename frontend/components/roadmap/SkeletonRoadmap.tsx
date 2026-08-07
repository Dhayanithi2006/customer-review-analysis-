import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonRoadmap() {
  return (
    <div className="space-y-8 animate-fade-in">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="relative pl-8" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="absolute left-1 top-6 w-4 h-4 rounded-full bg-[#1e2235]" />
          <div className="rounded-2xl border border-white/7 bg-[#0f111a] p-5 ml-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Skeleton className="h-3 w-14 mb-2" />
                <Skeleton className="h-5 w-48" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex gap-2 mb-4">
              {[...Array(3)].map((_, j) => (
                <Skeleton key={j} className="h-6 w-24 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
