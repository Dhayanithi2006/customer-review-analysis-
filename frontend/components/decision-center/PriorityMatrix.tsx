"use client";

import type { IssueCluster } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  bandStyles,
  estimatedImpact,
  formatRisk,
  issueTitle,
  pillarValue,
  priorityBand,
  priorityScore100,
} from "./helpers";

interface PriorityMatrixProps {
  issues: IssueCluster[];
  selectedKey: string | null;
  onSelect: (issue: IssueCluster) => void;
  currency?: string;
}

/**
 * 2×2: Customer Reach (x) vs Revenue Impact pillar (y).
 */
export function PriorityMatrix({
  issues,
  selectedKey,
  onSelect,
  currency = "INR",
}: PriorityMatrixProps) {
  const points = issues.slice(0, 12).map((issue, idx) => {
    const pillars = issue.decision_pillars;
    const reach =
      pillarValue(pillars, "customer_reach") ??
      Math.min(100, issue.customer_reach_percentage ?? (issue.review_count || 0) * 2);
    const revenue =
      pillarValue(pillars, "revenue_impact") ??
      Math.min(100, ((estimatedImpact(issue) || 0) > 0 ? 50 : 10));
    return { issue, idx, x: reach, y: revenue };
  });

  return (
    <section className="mb-10">
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
          Priority matrix
        </p>
        <h3 className="text-lg font-extrabold text-white tracking-tight">
          Revenue × Reach
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-xl leading-relaxed">
          Top-right = fix soon. Positions use stored backend pillar values for this analysis.
        </p>
      </div>

      <div className="rounded-[20px] border border-border bg-surface p-4 md:p-6">
        <div className="relative h-[280px] md:h-[320px] rounded-2xl bg-[#0A0E18] border border-white/[0.04] overflow-hidden">
          <span className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-wider text-slate-600">
            High rev · Low reach
          </span>
          <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider text-red-400/70">
            Fix zone
          </span>
          <span className="absolute bottom-3 left-3 text-[9px] font-bold uppercase tracking-wider text-slate-600">
            Monitor
          </span>
          <span className="absolute bottom-3 right-3 text-[9px] font-bold uppercase tracking-wider text-amber-400/70">
            High reach · Low rev
          </span>

          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.06]" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.06]" />

          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 font-semibold">
            Customer Reach →
          </span>
          <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[9px] text-slate-600 font-semibold whitespace-nowrap">
            Est. Revenue Impact →
          </span>

          {points.map(({ issue, idx, x, y }) => {
            const rank = issue.priority_rank || idx + 1;
            const band = priorityBand(issue, rank);
            const styles = bandStyles(band);
            const active = selectedKey === issue.issue_key;
            const left = `${Math.min(92, Math.max(6, x))}%`;
            const top = `${Math.min(92, Math.max(6, 100 - y))}%`;
            const score = priorityScore100(issue.priority_score);
            const impact = estimatedImpact(issue);

            return (
              <button
                key={issue.issue_key}
                type="button"
                title={`${issueTitle(issue.issue_key)} · ${band} · ${score ?? "—"} · ${formatRisk(impact, currency)}`}
                onClick={() => onSelect(issue)}
                className={cn(
                  "absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  rank === 1 ? "w-5 h-5" : "w-3 h-3",
                  styles.bar,
                  active && "ring-2 ring-white scale-125"
                )}
                style={{ left, top }}
              />
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((b) => {
            const s = bandStyles(b);
            return (
              <span key={b} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                <span className={cn("w-2 h-2 rounded-full", s.bar)} />
                {b}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
