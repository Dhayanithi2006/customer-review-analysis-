"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBusiness, updateWorkspaceSettings } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];

export default function WorkspaceSettingsPage() {
  const params     = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz]                   = useState<BusinessResponse | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  // Editable fields
  const [monthlyCustomers, setMonthlyCustomers] = useState("500");
  const [avgRevenue, setAvgRevenue]             = useState("500");
  const [premiumPct, setPremiumPct]             = useState("20");
  const [currency, setCurrency]                 = useState("INR");

  useEffect(() => {
    getBusiness(businessId)
      .then(b => {
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
        monthly_customers:   parseInt(monthlyCustomers) || 500,
        avg_revenue_per_user: parseFloat(avgRevenue) || 500,
        premium_pct:         parseFloat(premiumPct) || 20,
        currency,
      });
      setBiz(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* error toast handled by api module */ }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (!biz) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚙️</span>
          <h1 className="text-xl font-black text-slate-100">Workspace Settings</h1>
        </div>
        <p className="text-xs text-slate-500">Revenue settings power the Decision Engine&apos;s impact calculations. All estimates can be updated anytime.</p>
      </div>

      {/* Read-only info */}
      <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Business Identity</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          {[
            { label: "Business Name", value: biz.business_name },
            { label: "Industry",      value: biz.industry },
            { label: "Email",         value: biz.email },
            { label: "Feedback Method", value: biz.feedback_method },
          ].map(f => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{f.label}</p>
              <p className="text-slate-200 font-semibold">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue settings (editable) */}
      <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Revenue Settings</h2>
        <p className="text-[11px] text-slate-600 mb-5">
          These values are used by the Decision Engine to calculate Revenue at Risk.<br />
          Formula: <span className="font-mono text-indigo-400">Revenue at Risk = Affected Users × Avg Revenue Per User × (1 + Premium % × 0.5)</span>
        </p>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Monthly Customers</label>
              <input
                type="number"
                value={monthlyCustomers}
                onChange={e => setMonthlyCustomers(e.target.value)}
                min="1"
                className="w-full bg-[#161827] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Avg Revenue Per Customer</label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="bg-[#161827] border border-white/8 rounded-xl px-2.5 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  value={avgRevenue}
                  onChange={e => setAvgRevenue(e.target.value)}
                  min="0"
                  className="flex-1 bg-[#161827] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Premium / Paying Customers — {premiumPct}%
            </label>
            <input
              type="range"
              value={premiumPct}
              onChange={e => setPremiumPct(e.target.value)}
              min="0" max="100" step="5"
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>0% (all free)</span>
              <span>50%</span>
              <span>100% (all paying)</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Premium customers receive 1.5× revenue weight in priority scoring.</p>
          </div>
        </div>
      </div>

      {/* Workspace URLs */}
      <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Workspace URLs</h2>
        <div className="space-y-3">
          {[
            { label: "Dashboard URL", value: biz.dashboard_url, color: "indigo" },
            { label: "Feedback URL",  value: biz.feedback_url,  color: "cyan"   },
          ].map(f => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">{f.label}</p>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#161827] border border-white/5">
                <p className={`text-[11px] font-mono text-${f.color}-400 flex-1 truncate`}>{f.value}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(f.value)}
                  className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
          saved
            ? "bg-emerald-600 text-white"
            : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
        }`}
      >
        {saving ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
        ) : saved ? (
          "✓ Settings Saved"
        ) : (
          "Save Settings"
        )}
      </button>
    </div>
  );
}
