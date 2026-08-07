import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

interface LoadingStateProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

/** Inline or full-screen loading indicator */
export function LoadingState({
  label = "Loading…",
  className,
  fullScreen = false,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullScreen ? "min-h-screen bg-background" : "py-16",
        className
      )}
    >
      <Spinner size={fullScreen ? "lg" : "md"} label={label} />
    </div>
  );
}

/** Generic content skeleton for list/dashboard placeholders */
export function ContentSkeleton({
  variant = "dashboard",
  className,
}: {
  variant?: "dashboard" | "list" | "detail" | "form";
  className?: string;
}) {
  if (variant === "list") {
    return (
      <div className={cn("flex flex-col gap-3 animate-fade-in", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 rounded-[16px] border border-border bg-surface"
          >
            <Skeleton className="h-4 w-6" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("space-y-6 animate-fade-in", className)}>
        <Skeleton className="h-8 w-64" />
        <SkeletonText lines={4} />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className={cn("space-y-5 max-w-lg animate-fade-in", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-[16px]" />
          </div>
        ))}
        <Skeleton className="h-11 w-32 rounded-[16px]" />
      </div>
    );
  }

  return (
    <div className={cn("animate-fade-in space-y-6", className)}>
      <Skeleton className="h-16 w-full rounded-[18px]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-[18px]" />
      <div className="flex gap-2 mb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 rounded-[16px] border border-border bg-surface"
          >
            <Skeleton className="h-4 w-6" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
