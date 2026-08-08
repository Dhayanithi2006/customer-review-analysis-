"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatRisk } from "./helpers";

export interface BusinessAssumptions {
  monthly_customers?: number | null;
  avg_revenue_per_user?: number | null;
  premium_pct?: number | null;
  currency?: string;
  configured?: boolean;
  business_id?: string | null;
  edit_path?: string | null;
  disclaimer?: string;
}

interface AssumptionsPanelProps {
  assumptions?: BusinessAssumptions | null;
  businessId: string;
}

export function AssumptionsPanel({ assumptions, businessId }: AssumptionsPanelProps) {
  const currency = assumptions?.currency || "INR";
  const monthly = assumptions?.monthly_customers;
  const arpu = assumptions?.avg_revenue_per_user;
  const premium = assumptions?.premium_pct;
  const configured = assumptions?.configured;
  const editHref = assumptions?.edit_path || `/business/${businessId}/settings`;

  return (
    <section className="mb-8">
      <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">
              Revenue assumptions
            </p>
            <h3 className="text-base font-extrabold text-white tracking-tight">
              Workspace metrics power Estimated Revenue Impact
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xl leading-relaxed">
              {assumptions?.disclaimer ||
                "Figures are Estimated Revenue Impact / at Risk — not actual revenue lost."}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={editHref}>Edit assumptions</Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Monthly customers"
            value={monthly != null && monthly > 0 ? String(monthly.toLocaleString()) : "Not set"}
            warn={!monthly}
          />
          <Metric
            label="ARPU"
            value={arpu != null && arpu > 0 ? formatRisk(arpu, currency) : "Not set"}
            warn={!arpu}
          />
          <Metric
            label="Premium %"
            value={premium != null ? `${premium}%` : "Not set"}
          />
          <Metric label="Currency" value={currency} />
        </div>

        {!configured && (
          <p className="mt-4 text-xs text-amber-300/90 font-semibold">
            Configure monthly customers and ARPU so Estimated Revenue Impact reflects your business.
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#0E1424] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className={`mt-1 text-sm font-bold font-mono ${warn ? "text-amber-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
