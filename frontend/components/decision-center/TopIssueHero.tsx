"use client";

import type { IssueCluster } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  affectedCustomers,
  bandStyles,
  estimatedImpact,
  formatRisk,
  issueTitle,
  priorityBand,
  priorityScore100,
  recommendedAction,
  whyThisMatters,
} from "./helpers";
import { LifecycleStrip } from "./LifecycleStrip";

interface TopIssueHeroProps {
  issue: IssueCluster | null;
  aiRecommendation?: string;
  isDemoData?: boolean;
  totalIssues: number;
  resolutionStatus?: string;
  why?: string | null;
  currency?: string;
  onViewEvidence: () => void;
  onOpenActions?: () => void;
}

export function TopIssueHero({
  issue,
  aiRecommendation,
  isDemoData,
  totalIssues,
  resolutionStatus,
  why,
  currency = "INR",
  onViewEvidence,
  onOpenActions,
}: TopIssueHeroProps) {
  if (!issue) {
    return (
      <section className="mb-8 rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
          What should we fix first?
        </h1>
        <p className="text-sm text-slate-400">
          Ranks by estimated business impact, not complaint count. Run an analysis to generate a decision brief.
        </p>
      </section>
    );
  }

  const rank = issue.priority_rank || 1;
  const band = priorityBand(issue, rank);
  const styles = bandStyles(band);
  const score = priorityScore100(issue.priority_score);
  const impact = estimatedImpact(issue);
  const affected = affectedCustomers(issue);

  return (
    <section className={cn("mb-8 rounded-2xl border bg-surface p-6 md:p-8", styles.border)}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Fix this first
        </p>
        {isDemoData && <Badge variant="warning">Demo / sample data</Badge>}
      </div>

      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
        What should we fix first?
      </h1>
      <p className="mt-2 text-sm text-slate-400 max-w-2xl">
        Ranks by estimated business impact, not complaint count.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wider border",
            styles.badge
          )}
        >
          {styles.label}
        </span>
        <Badge variant="outline">{issue.category}</Badge>
        {score != null && (
          <span className="text-xs font-mono font-bold text-primary-soft">
            Score {score}/100
          </span>
        )}
        <span className="text-xs text-slate-600 font-mono">
          #{String(rank).padStart(2, "0")} of {totalIssues}
        </span>
      </div>

      <h2 className="mt-4 text-xl md:text-2xl font-extrabold text-white tracking-tight">
        {issueTitle(issue.issue_key)}
      </h2>

      <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-2xl">
        {why || whyThisMatters(issue, currency)}
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
        <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3 py-2.5">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Est. revenue impact</p>
          <p className="text-sm font-bold font-mono text-red-300 mt-1">{formatRisk(impact, currency)}</p>
        </div>
        <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3 py-2.5">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Observed affected</p>
          <p className="text-sm font-bold font-mono text-white mt-1">{affected}</p>
        </div>
        <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3 py-2.5">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Severity</p>
          <p className="text-sm font-bold font-mono text-white mt-1">
            {(issue.avg_severity || 0).toFixed(1)} / 5
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-2xl">
        {recommendedAction(issue, rank, aiRecommendation)}
      </p>

      <div className="mt-5">
        <LifecycleStrip status={resolutionStatus} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onViewEvidence}>View evidence</Button>
        {onOpenActions && (
          <Button variant="secondary" onClick={onOpenActions}>
            Plan / take action
          </Button>
        )}
      </div>

      <p className="mt-4 text-[11px] text-slate-600 leading-relaxed max-w-xl">
        Priority = Revenue × 35% + Reach × 30% + Severity × 20% + Tier × 15% (backend).
        Estimated impact = affected × ARPU × severity risk factor.
      </p>
    </section>
  );
}
