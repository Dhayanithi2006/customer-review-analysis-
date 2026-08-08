"use client";

import type { IssueCluster } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bandStyles,
  estimatedImpact,
  formatRisk,
  issueTitle,
  pillarValue,
  priorityBand,
  priorityScore100,
  reachPercentage,
  resolutionStatusLabel,
  isReopenedStatus,
  affectedCustomers,
} from "./helpers";
import { LifecycleStrip } from "./LifecycleStrip";

interface PriorityListProps {
  issues: IssueCluster[];
  selectedKey: string | null;
  statusByKey?: Record<string, string | undefined>;
  currency?: string;
  onSelect: (issue: IssueCluster) => void;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold">
        {label}
      </p>
      <p className="text-xs font-mono font-semibold text-slate-200 mt-0.5 truncate">
        {value}
      </p>
    </div>
  );
}

export function PriorityList({
  issues,
  selectedKey,
  statusByKey = {},
  currency = "INR",
  onSelect,
}: PriorityListProps) {
  return (
    <section className="mb-8">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">
          Priority issues
        </p>
        <h3 className="text-lg font-extrabold text-white tracking-tight">
          Ranked by estimated business impact
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Sorted by priority score — not feedback volume.
        </p>
      </div>

      <div className="grid gap-3">
        {issues.map((issue, idx) => {
          const rank = issue.priority_rank || idx + 1;
          const band = priorityBand(issue, rank);
          const styles = bandStyles(band);
          const active = selectedKey === issue.issue_key;
          const score = priorityScore100(issue.priority_score);
          const pillars = issue.decision_pillars;
          const reach = reachPercentage(issue);
          const tier =
            pillarValue(pillars, "customer_tier") ??
            pillarValue(pillars, "premium_users");
          const status = statusByKey[issue.issue_key];
          const reopened = isReopenedStatus(status);

          return (
            <article
              key={issue.id || issue.issue_key}
              className={cn(
                "rounded-2xl border bg-surface p-4 md:p-5 transition-colors",
                active ? "border-primary/40 bg-primary/[0.04]" : "border-border",
                reopened && !active && "border-red-500/30"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] text-slate-600">
                      #{String(rank).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider border",
                        styles.badge
                      )}
                    >
                      {band}
                    </span>
                    <span className="text-xs text-slate-500">{issue.category}</span>
                    {score != null && (
                      <span className="text-xs font-mono font-bold text-primary-soft">
                        Score {score}/100
                      </span>
                    )}
                    {status && (
                      <span
                        className={cn(
                          "text-[11px]",
                          reopened ? "text-red-300 font-semibold" : "text-slate-500"
                        )}
                      >
                        {resolutionStatusLabel(status)}
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-white tracking-tight">
                    {issueTitle(issue.issue_key)}
                  </h4>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <Metric
                      label="Est. revenue impact"
                      value={formatRisk(estimatedImpact(issue), currency)}
                    />
                    <Metric
                      label="Customer reach %"
                      value={reach != null ? `${reach.toFixed(1)}%` : "—"}
                    />
                    <Metric
                      label="Severity"
                      value={`${(issue.avg_severity || 0).toFixed(1)} / 5`}
                    />
                    <Metric
                      label="Customer tier"
                      value={
                        tier != null
                          ? String(Math.round(tier))
                          : String(issue.premium_user_count || "—")
                      }
                    />
                    <Metric
                      label="Observed affected"
                      value={String(affectedCustomers(issue))}
                    />
                  </div>

                  {status && (
                    <div className="mt-3">
                      <LifecycleStrip status={status} compact />
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <Button
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => onSelect(issue)}
                  >
                    Evidence
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
