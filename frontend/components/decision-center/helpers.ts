/** Decision Center shared helpers — Revenue Impact + Decision Center */

import type { IssueCluster, DecisionPillars } from "@/lib/types";

export type PriorityBand = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export function formatRisk(value: number, currency = "INR") {
  if (!value || value <= 0) return "—";
  const sym = currency.toUpperCase() === "INR" || currency === "₹" ? "₹" : `${currency} `;
  if (value >= 10000000) return `${sym}${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${sym}${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${sym}${(value / 1000).toFixed(1)}K`;
  return `${sym}${Math.round(value).toLocaleString()}`;
}

/** Absolute estimated revenue impact for an issue (prefer pillars). */
export function issueRevenueImpact(issue: IssueCluster): number {
  const pillars = issue.decision_pillars;
  return (
    pillars?.estimated_revenue_impact ||
    issue.estimated_revenue_impact ||
    issue.revenue_at_risk ||
    0
  );
}

/** Observed affected customers for display. */
export function issueAffectedCustomers(issue: IssueCluster): number {
  const pillars = issue.decision_pillars;
  return (
    pillars?.affected_customers ||
    issue.affected_customers ||
    issue.review_count ||
    0
  );
}

/** Reach % of monthly customers when available. */
export function issueReachPct(issue: IssueCluster): number | null {
  const pillars = issue.decision_pillars;
  const pct =
    pillars?.customer_reach_percentage ?? issue.customer_reach_percentage ?? null;
  if (pct == null || Number.isNaN(Number(pct))) return null;
  return Math.round(Number(pct) * 10) / 10;
}

export function issueTitle(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function priorityScore100(score?: number | null) {
  if (score == null || Number.isNaN(score)) return null;
  const n = score <= 1.5 ? score * 100 : score;
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** Strong visual bands from deterministic priority score + rank. */
export function priorityBand(issue: IssueCluster, rankFallback = 99): PriorityBand {
  const rank = issue.priority_rank || rankFallback;
  const score = priorityScore100(issue.priority_score) ?? 0;
  if (rank === 1 || score >= 70) return "CRITICAL";
  if (rank <= 3 || score >= 50) return "HIGH";
  if (rank <= 6 || score >= 30) return "MEDIUM";
  return "LOW";
}

export function bandStyles(band: PriorityBand) {
  switch (band) {
    case "CRITICAL":
      return {
        badge: "bg-red-500/20 text-red-300 border-red-500/40",
        border: "border-red-500/35",
        glow: "ring-1 ring-red-500/25",
        bar: "bg-red-500",
        label: "CRITICAL",
      };
    case "HIGH":
      return {
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/35",
        border: "border-amber-500/30",
        glow: "ring-1 ring-amber-500/20",
        bar: "bg-amber-500",
        label: "HIGH",
      };
    case "MEDIUM":
      return {
        badge: "bg-[#8B7FF8]/20 text-[#C4BFFF] border-[#8B7FF8]/30",
        border: "border-[#8B7FF8]/25",
        glow: "",
        bar: "bg-[#8B7FF8]",
        label: "MEDIUM",
      };
    default:
      return {
        badge: "bg-slate-500/15 text-slate-400 border-slate-500/25",
        border: "border-white/[0.08]",
        glow: "",
        bar: "bg-slate-500",
        label: "LOW",
      };
  }
}

export function recommendedAction(issue: IssueCluster, rank: number, aiRec?: string) {
  if (rank === 1 && aiRec) return aiRec;
  if (issue.description) return issue.description;
  const band = priorityBand(issue, rank);
  if (band === "CRITICAL") {
    return `Fix ${issueTitle(issue.issue_key)} in the next sprint — highest estimated business impact.`;
  }
  if (band === "HIGH") {
    return `Schedule ${issueTitle(issue.issue_key)} for the current or next planning cycle.`;
  }
  if (band === "MEDIUM") {
    return `Backlog ${issueTitle(issue.issue_key)} with a clear owner — monitor volume.`;
  }
  return `Track ${issueTitle(issue.issue_key)}; revisit if reach or severity rises.`;
}

export function estimatedImpact(issue: IssueCluster): number {
  return (
    issue.estimated_revenue_impact ??
    issue.revenue_at_risk ??
    issue.decision_pillars?.estimated_revenue_impact ??
    0
  );
}

export function affectedCustomers(issue: IssueCluster): number {
  return (
    issue.affected_customers ??
    issue.decision_pillars?.affected_customers ??
    issue.review_count ??
    0
  );
}

export function reachPercentage(issue: IssueCluster): number | null {
  const v =
    issue.customer_reach_percentage ??
    issue.decision_pillars?.customer_reach_percentage ??
    issue.decision_pillars?.customer_reach;
  return typeof v === "number" ? v : null;
}

export const PILLAR_META = [
  { key: "revenue" as const, label: "Revenue Impact", weight: "35%", field: "revenue_impact" as const, pctField: "revenue_pct" as const, color: "bg-red-400" },
  { key: "reach" as const, label: "Customer Reach", weight: "30%", field: "customer_reach" as const, pctField: "reach_pct" as const, color: "bg-[#A99FFF]" },
  { key: "severity" as const, label: "Severity", weight: "20%", field: "severity" as const, pctField: "severity_pct" as const, color: "bg-amber-400" },
  { key: "tier" as const, label: "Customer Tier", weight: "15%", field: "premium_users" as const, pctField: "premium_pct" as const, color: "bg-violet-400" },
];

export function pillarValue(pillars: DecisionPillars | undefined, field: keyof DecisionPillars) {
  if (!pillars) return null;
  const v = pillars[field];
  return typeof v === "number" ? v : null;
}

export function resolutionStatusLabel(status?: string) {
  if (!status || status === "IDENTIFIED") return "Identified";
  if (status === "ACTION_PLANNED") return "Action Planned";
  if (status === "ACTION_TAKEN") return "Action Taken";
  if (status === "FOLLOW_UP_SENT") return "Follow-up Sent";
  if (status === "IMPROVED") return "Improved";
  if (status === "REOPENED") return "Reopened — needs attention";
  return status;
}

export function isReopenedStatus(status?: string) {
  return status === "REOPENED";
}

/** Keep REOPENED issues visible and first among active work. */
export function sortIssuesForAttention<T extends { issue_key: string; priority_rank?: number }>(
  issues: T[],
  statusByKey: Record<string, string | undefined>
): T[] {
  return [...issues].sort((a, b) => {
    const aRe = statusByKey[a.issue_key] === "REOPENED" ? 0 : 1;
    const bRe = statusByKey[b.issue_key] === "REOPENED" ? 0 : 1;
    if (aRe !== bRe) return aRe - bRe;
    return (a.priority_rank || 99) - (b.priority_rank || 99);
  });
}

export function whyThisMatters(issue: IssueCluster, currency = "INR"): string {
  const affected = affectedCustomers(issue);
  const impact = estimatedImpact(issue);
  const reach = reachPercentage(issue);
  const sev = issue.avg_severity || 0;
  const score = priorityScore100(issue.priority_score);
  const bits: string[] = [];
  bits.push(`${affected} observed customers affected`);
  if (reach != null) bits.push(`${reach.toFixed(1)}% customer reach`);
  bits.push(`severity ${sev.toFixed(1)}/5`);
  if (impact > 0) bits.push(`${formatRisk(impact, currency)} estimated revenue impact`);
  if (score != null) bits.push(`priority ${score}/100`);
  return `${bits.join(" · ")}. Ranked by estimated business impact — not complaint count.`;
}
