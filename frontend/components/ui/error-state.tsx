import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function ErrorState({
  title = "We couldn’t load this view",
  message = "Please try again. If the problem continues, re-run analysis from your workspace.",
  onRetry,
  fullScreen = false,
  className,
  icon,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "min-h-screen bg-background" : "w-full py-12",
        className
      )}
      role="alert"
    >
      <div className="text-center max-w-sm px-6 animate-fade-in">
        <div className="w-14 h-14 rounded-[16px] bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-5 text-red-400">
          {icon ?? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">{title}</h2>
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
