import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonSprint() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Sprint header chips */}
      <div className="flex gap-3 flex-wrap">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-32 rounded-xl" />
        ))}
      </div>

      {/* Priority groups */}
      {["High Priority", "Medium Priority"].map(group => (
        <div key={group}>
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-40 mb-2" />
                    <Skeleton className="h-4 w-64 mb-2" />
                    <Skeleton className="h-3 w-80" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
