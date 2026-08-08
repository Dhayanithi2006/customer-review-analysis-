"use client";

import type { IssueCluster } from "@/lib/types";
import { cn } from "@/lib/utils";
import { estimatedImpact, formatRisk, issueTitle, priorityBand, bandStyles } from "./helpers";

interface RevenueImpactChartProps {
  issues: IssueCluster[];
  currency?: string;
  selectedKey?: string | null;
  onSelect?: (issue: IssueCluster) => void;
}

/** Horizontal bar chart: Estimated Revenue Impact by Issue (real stored data). */
export function RevenueImpactChart({
  issues,
  currency = "INR",
  selectedKey,
  onSelect,
}: RevenueImpactChartProps) {
  const rows = [...issues]
    .filter((i) => estimatedImpact(i) > 0 || (i.priority_rank || 99) <= 8)
    .sort((a, b) => estimatedImpact(b) - estimatedImpact(a))
    .slice(0, 8);

  const max = Math.max(...rows.map((r) => estimatedImpact(r)), 1);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">
          Estimated revenue impact
        </p>
        <h3 className="text-lg font-extrabold text-white tracking-tight">
          By issue
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Estimated Revenue Impact / at Risk from workspace assumptions — not actual losses.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 md:p-5 space-y-3">
        {rows.map((issue, idx) => {
          const impact = estimatedImpact(issue);
          const pct = Math.max(4, (impact / max) * 100);
          const band = priorityBand(issue, issue.priority_rank || idx + 1);
          const styles = bandStyles(band);
          const active = selectedKey === issue.issue_key;

          return (
            <button
              key={issue.issue_key}
              type="button"
              onClick={() => onSelect?.(issue)}
              className={cn(
                "w-full text-left group",
                active && "opacity-100"
              )}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {issueTitle(issue.issue_key)}
                </span>
                <span className="text-xs font-mono font-bold text-red-300 shrink-0">
                  {formatRisk(impact, currency)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    styles.bar,
                    active && "ring-1 ring-white/40"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
