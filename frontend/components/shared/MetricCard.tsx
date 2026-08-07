"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface MetricCardProps {
  label: string;
  value: string;
  /** Optional numeric target for count-up animation */
  countTo?: number;
  countPrefix?: string;
  countSuffix?: string;
  countDecimals?: number;
  sub?: string;
  accentColor?: string;
  icon?: ReactNode;
  id?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  countTo,
  countPrefix = "",
  countSuffix = "",
  countDecimals = 0,
  sub,
  accentColor,
  icon,
  id,
  className,
}: MetricCardProps) {
  return (
    <div
      id={id}
      className={cn(
        "relative overflow-hidden rounded-[18px] border border-border bg-surface p-5 md:p-6",
        "shadow-card card-elevated hover-lift group",
        className
      )}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: "linear-gradient(90deg, #6D5DF6, #8B7FF8)" }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            {label}
          </p>
          <p
            className="text-2xl font-extrabold tracking-tight leading-none truncate text-white"
            style={accentColor ? { color: accentColor } : undefined}
          >
            {typeof countTo === "number" ? (
              <AnimatedCounter
                value={countTo}
                prefix={countPrefix}
                suffix={countSuffix}
                decimals={countDecimals}
              />
            ) : (
              value
            )}
          </p>
          {sub && (
            <p className="text-xs text-slate-500 mt-2 leading-tight">{sub}</p>
          )}
        </div>
        {icon && (
          <span className="text-slate-500 shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-105 [&_svg]:size-5">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
