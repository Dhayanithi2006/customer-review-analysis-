"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 p-1 rounded-[16px] bg-background border border-border",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex-1 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              size === "sm" ? "py-2 px-2 text-xs" : "py-2.5 px-3 text-xs",
              active
                ? "bg-primary text-white shadow-[0_4px_14px_rgba(109,93,246,0.28)]"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
