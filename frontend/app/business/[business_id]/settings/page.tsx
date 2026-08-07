"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getBusiness, updateWorkspaceSettings } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz] = useState<BusinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [monthlyCustomers, setMonthlyCustomers] = useState("500");
  const [avgRevenue, setAvgRevenue] = useState("500");
  const [premiumPct, setPremiumPct] = useState("20");
  const [currency, setCurrency] = useState("INR");

  useEffect(() => {
    getBusiness(businessId)
      .then((b) => {
        setBiz(b);
        setMonthlyCustomers(String(b.monthly_customers));
        setAvgRevenue(String(b.avg_revenue_per_user));
        setPremiumPct(String(b.premium_pct));
        setCurrency(b.currency);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [businessId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateWorkspaceSettings(businessId, {
        monthly_customers: parseInt(monthlyCustomers) || 500,
        avg_revenue_per_user: parseFloat(avgRevenue) || 500,
        premium_pct: parseFloat(premiumPct) || 20,
        currency,
      });
      setBiz(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      /* toast handled by api */
    } finally {
      setSaving(false);
    }
  };

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <WorkspacePage width="narrow">
        <ContentSkeleton variant="form" />
      </WorkspacePage>
    );
  }

  if (!biz) {
    return (
      <WorkspacePage width="narrow">
        <EmptyState
          title="Workspace not found"
          description="This business workspace could not be loaded."
          action={{ label: "Go home", href: "/" }}
        />
      </WorkspacePage>
    );
  }

  const fieldClass =
    "w-full h-11 rounded-[16px] border border-white/[0.08] bg-surface-2 px-3 text-sm text-white outline-none transition-all focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(109,93,246,0.22)]";

  return (
    <WorkspacePage width="narrow">
      <PageIntro
        eyebrow="Settings"
        title="Workspace settings"
        description="Revenue assumptions power Decision Center impact scoring. Update them anytime."
      />

      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-5 card-elevated">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-4">
          Business identity
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Business name", value: biz.business_name },
            { label: "Industry", value: biz.industry },
            { label: "Email", value: biz.email },
            { label: "Feedback method", value: biz.feedback_method },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1 font-semibold">
                {f.label}
              </p>
              <p className="text-sm text-slate-200 font-semibold">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-5 card-elevated">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1">
          Revenue settings
        </h2>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Used to estimate revenue at risk. Premium customers receive 1.5× weight in priority scoring.
        </p>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthly-customers">Monthly customers</Label>
              <Input
                id="monthly-customers"
                type="number"
                value={monthlyCustomers}
                onChange={(e) => setMonthlyCustomers(e.target.value)}
                min={1}
              />
            </div>
            <div>
              <Label htmlFor="avg-revenue">Avg revenue per customer</Label>
              <div className="flex gap-2">
                <select
                  id="currency"
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={`${fieldClass} w-[88px] shrink-0`}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Input
                  id="avg-revenue"
                  type="number"
                  value={avgRevenue}
                  onChange={(e) => setAvgRevenue(e.target.value)}
                  min={0}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="premium-pct">
              Premium / paying customers — {premiumPct}%
            </Label>
            <input
              id="premium-pct"
              type="range"
              value={premiumPct}
              onChange={(e) => setPremiumPct(e.target.value)}
              min={0}
              max={100}
              step={5}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>0% free</span>
              <span>50%</span>
              <span>100% paying</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-6 card-elevated">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-4">
          Workspace URLs
        </h2>
        <div className="space-y-3">
          {[
            { label: "Dashboard URL", value: biz.dashboard_url },
            { label: "Feedback URL", value: biz.feedback_url },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5 font-semibold">
                {f.label}
              </p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-white/[0.05]">
                <p className="text-[11px] font-mono text-primary-soft flex-1 truncate">
                  {f.value}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyValue(f.label, f.value)}
                >
                  {copied === f.label ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Button
        onClick={handleSave}
        disabled={saving}
        size="lg"
        className="w-full justify-center"
        variant={saved ? "success" : "default"}
      >
        {saving ? "Saving…" : saved ? "Settings saved" : "Save settings"}
      </Button>
    </WorkspacePage>
  );
}
