"use client";

import type { DashboardData, IssueCluster } from "@/lib/types";
import { affectedCustomers, formatRisk, priorityBand } from "./helpers";

interface ImpactSummaryProps {
  dashboard: DashboardData;
  topIssue?: IssueCluster | null;
  issues: IssueCluster[];
  currency?: string;
}

export function ImpactSummary({ dashboard, issues, currency = "INR" }: ImpactSummaryProps) {
  const kpis = dashboard.kpis || dashboard.decision_center?.kpis;
  const criticalCount =
    kpis?.critical_issue_count ??
    issues.filter((issue, idx) => {
      const band = priorityBand(issue, issue.priority_rank || idx + 1);
      return band === "CRITICAL";
    }).length;

  const totalImpact =
    kpis?.total_estimated_revenue_impact ??
    dashboard.estimated_revenue_impact_total ??
    dashboard.revenue_at_risk ??
    0;

  const atRisk =
    kpis?.revenue_at_risk_critical_high ?? totalImpact;

  const customers =
    kpis?.customers_affected ??
    issues.reduce((sum, i) => sum + affectedCustomers(i), 0);

  const cards = [
    {
      label: "Estimated revenue impact",
      value: formatRisk(totalImpact, currency),
      emphasize: true,
    },
    {
      label: "Revenue at risk (critical/high)",
      value: formatRisk(atRisk, currency),
      emphasize: true,
    },
    {
      label: "Customers affected",
      value: String(customers),
    },
    {
      label: "Critical issues",
      value: String(criticalCount),
    },
  ];

  return (
    <section className="mb-8">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Business impact
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Estimated Revenue Impact / at Risk — not actual revenue lost.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-surface px-4 py-4"
          >
            <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold">
              {card.label}
            </p>
            <p
              className={`mt-2 text-xl font-extrabold font-mono tracking-tight ${
                card.emphasize ? "text-red-300" : "text-white"
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>
      {dashboard.is_demo_data && (
        <p className="text-[11px] text-amber-400/90 mt-3 font-semibold">
          Demo / sample data — rankings come from the backend formula, not hardcoded order.
        </p>
      )}
    </section>
  );
}
