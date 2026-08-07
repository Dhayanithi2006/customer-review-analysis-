import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  optional?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, optional, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-slate-400",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
      {optional && (
        <span className="ml-1.5 normal-case tracking-normal font-medium text-slate-600">
          (optional)
        </span>
      )}
    </label>
  )
);
Label.displayName = "Label";

export { Label };
