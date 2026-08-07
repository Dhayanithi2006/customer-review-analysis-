"use client";

import * as React from "react";
import { chartTheme, colors } from "@/lib/design-system";
import { cn } from "@/lib/utils";

/** Shared chart card shell */
export function ChartCard({
  title,
  description,
  children,
  className,
  legend,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  legend?: Array<{ label: string; color: string }>;
}) {
  return (
    <div className={cn("chart-card", className)}>
      {(title || description) && (
        <div className="mb-5">
          {title && (
            <h3 className="text-sm font-bold text-slate-200 tracking-tight">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          )}
        </div>
      )}
      {children}
      {legend && legend.length > 0 && (
        <div className="chart-legend">
          {legend.map((item) => (
            <div key={item.label} className="chart-legend-item">
              <span
                className="chart-legend-swatch"
                style={{ background: item.color }}
              />
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Default Recharts tooltip styling */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg text-xs"
      style={{
        background: chartTheme.tooltip.background,
        borderColor: chartTheme.tooltip.border,
        color: chartTheme.tooltip.text,
      }}
    >
      {label != null && (
        <p className="font-semibold mb-1.5 text-slate-200">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-slate-400">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: entry.color || colors.primary }}
            />
            <span>{entry.name}</span>
            <span className="ml-auto font-semibold text-white">
              {valueFormatter && entry.value != null
                ? valueFormatter(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const chartAxisTick = {
  fill: chartTheme.axis,
  fontSize: 11,
  fontFamily: "var(--font-sans)",
} as const;

export { chartTheme, colors as chartColors };
