import { Spinner } from "@/components/ui/spinner";
import { ContentSkeleton } from "@/components/ui/loading-state";

export function PageLoader({
  label = "Loading…",
  skeleton = false,
}: {
  label?: string;
  skeleton?: boolean;
}) {
  if (skeleton) {
    return (
      <div className="min-h-screen bg-background px-5 sm:px-8 py-10 max-w-5xl mx-auto animate-fade-in">
        <ContentSkeleton variant="dashboard" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Spinner size="lg" label={label} />
    </div>
  );
}
