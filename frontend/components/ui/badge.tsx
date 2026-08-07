import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide border transition-colors",
  {
    variants: {
      variant: {
        default:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
        bug:       "bg-red-500/15 text-red-400 border-red-500/25",
        perf:      "bg-orange-500/15 text-orange-400 border-orange-500/25",
        ux:        "bg-purple-500/15 text-purple-400 border-purple-500/25",
        feature:   "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
        praise:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
        pricing:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
        onboarding:"bg-blue-500/15 text-blue-400 border-blue-500/25",
        support:   "bg-pink-500/15 text-pink-400 border-pink-500/25",
        privacy:   "bg-violet-500/15 text-violet-400 border-violet-500/25",
        integration:"bg-teal-500/15 text-teal-400 border-teal-500/25",
        high:      "bg-red-500/20 text-red-300 border-red-500/30",
        medium:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
        low:       "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        quickwin:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
        outline:   "border-white/15 text-slate-300 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
