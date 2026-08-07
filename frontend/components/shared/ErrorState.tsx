import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08090e]">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-2xl mx-auto mb-4">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
