import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-[16px] border border-border bg-surface-2 px-4 py-3 text-sm text-white",
          "placeholder:text-slate-500",
          "transition-all duration-150 resize-y",
          "hover:border-white/12",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(109,93,246,0.22)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error &&
            "border-red-500/40 focus-visible:border-red-500 focus-visible:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
