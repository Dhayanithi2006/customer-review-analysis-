"use client";

import { ErrorState as UiErrorState } from "@/components/ui/error-state";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Full-screen error for session flows — business-focused defaults. */
export function ErrorState({
  title = "We couldn’t load this view",
  message = "Please try again. If the problem continues, re-run analysis from your workspace.",
  onRetry,
}: ErrorStateProps) {
  return (
    <UiErrorState
      title={title}
      message={message}
      onRetry={onRetry}
      fullScreen
    />
  );
}
