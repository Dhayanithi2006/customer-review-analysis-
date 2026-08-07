"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis } from "@/lib/business-api";
import { getDashboard } from "@/lib/api";
import type { DashboardData, IssueCluster } from "@/lib/types";


// Re-used mini components from existing dashboard
function SeverityBar({ value }: { value: number }) {
  const pct   = Math.round((value / 10) * 100);
  const color  = value >= 8 ? "bg-red-500" : value >= 5 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-slate-400 shrink-0">{value.toFixed(1)}</span>
    </div>
  );
}

function IssueRow({ cluster, businessId, rank, sessionId }: { cluster: IssueCluster; businessId: string; rank: number; sessionId: string }) {
  const score    = Math.round(cluster.priority_score * 100);
  const revenueK = cluster.revenue_at_risk > 0 ? `₹${(cluster.revenue_at_risk / 1000).toFixed(1)}K` : "—";
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/7 bg-[#0d0f1a] hover:border-indigo-500/25 hover:bg-[#111422] transition-all">
      <span className={`text-xs font-black font-mono w-6 shrink-0 ${rank === 1 ? "text-indigo-400" : "text-slate-600"}`}>#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-100 truncate">{cluster.issue_key.replace(/_/g, " ")}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{cluster.category} · {cluster.business_area}</p>
      </div>
      <div className="hidden sm:flex items-center gap-6 text-xs shrink-0">
        <div className="text-right">
          <p className="text-[10px] text-slate-600 mb-0.5">Freq</p>
          <p className="font-mono font-bold text-slate-200">{cluster.review_count}</p>
        </div>
        <div className="w-24">
          <p className="text-[10px] text-slate-600 mb-1">Severity</p>
          <SeverityBar value={cluster.avg_severity || 0} />
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-600 mb-0.5">Revenue Risk</p>
          <p className={`font-mono font-bold ${cluster.revenue_at_risk > 0 ? "text-red-400" : "text-slate-500"}`}>{revenueK}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-600 mb-0.5">Score</p>
          <p className="font-mono font-black text-indigo-400">{score}</p>
        </div>
      </div>
      <Link
        href={`/dashboard/${sessionId}/evidence/${cluster.issue_key}`}
        className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
      >
        Evidence →
      </Link>
    </div>
  );
}

export default function DecisionCenterPage() {
  const params        = useParams();
  const searchParams  = useSearchParams();
  const businessId    = params.business_id as string;
  const sessionParam  = searchParams.get("session");

  const [sessionId, setSessionId] = useState<string | null>(sessionParam);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [version, setVersion]     = useState<number | null>(null);
  const [label, setLabel]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        let sid = sessionParam;
        if (!sid) {
          const latest = await getLatestAnalysis(businessId);
          if (!latest.has_analysis || !latest.session_id) {
            setError(latest.message || "No analysis available yet.");
            setLoading(false);
            return;
          }
          sid = latest.session_id;
          setVersion(latest.version);
          setLabel(latest.label);
        }
        setSessionId(sid);
        const dash = await getDashboard(sid);
        setDashboard(dash);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId, sessionParam]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading Decision Center…</p>
      </div>
    </div>
  );

  if (error || !dashboard) return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-8 text-center">
        <p className="text-4xl mb-4">🧠</p>
        <h2 className="text-lg font-bold text-slate-100 mb-2">No Analysis Available</h2>
        <p className="text-sm text-slate-400 mb-6">{error || "Run your first analysis to see the Decision Center."}</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors no-underline">
            🚀 Upload Feedback
          </Link>
          <Link href={`/business/${businessId}`} className="px-5 py-2.5 rounded-xl border border-white/8 hover:border-white/15 text-slate-300 text-sm font-semibold transition-colors no-underline">
            ← Back to Workspace
          </Link>
        </div>
      </div>
    </div>
  );

  const issues = (dashboard.issues || []) as (IssueCluster & { session_id?: string })[];

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🧠</span>
            <h1 className="text-xl font-black text-slate-100">Decision Center</h1>
            {label && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[10px] font-bold">
                {label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">What issue should you fix first?</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/business/${businessId}/roadmap`} className="px-3.5 py-2 rounded-xl border border-white/8 hover:border-white/15 text-slate-300 text-xs font-semibold transition-colors no-underline">
            🗺️ Roadmap
          </Link>
          <Link href={`/business/${businessId}/sprint`} className="px-3.5 py-2 rounded-xl border border-white/8 hover:border-white/15 text-slate-300 text-xs font-semibold transition-colors no-underline">
            ⚡ Sprint
          </Link>
          <Link href="/" className="px-3.5 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors no-underline">
            ➕ New Analysis
          </Link>
        </div>
      </div>

      {/* Executive Summary */}
      {dashboard.executive_summary && (
        <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-5 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">AI Executive Brief</p>
          <p className="text-sm text-slate-300 leading-relaxed">{dashboard.executive_summary}</p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Reviews", value: dashboard.total_reviews?.toLocaleString() || "—" },
          { label: "Revenue at Risk", value: dashboard.revenue_at_risk > 0 ? `₹${(dashboard.revenue_at_risk / 1000).toFixed(1)}K` : "—" },
          { label: "Issues Found", value: issues.length.toString() },
          { label: "AI Confidence", value: `${dashboard.analysis_health?.ai_confidence || 94}%` },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-white/7 bg-[#0d0f1a] p-4">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1">{m.label}</p>
            <p className="text-xl font-black font-mono text-slate-100">{m.value}</p>
          </div>
        ))}
      </div>

      {/* AI Recommendation */}
      {dashboard.ai_recommendation && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">🎯 Top Recommendation</p>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">{dashboard.ai_recommendation}</p>
        </div>
      )}

      {/* Priority Issues */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Priority Issues — Ranked by Revenue Impact</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Score = Revenue×0.35 + Frequency×0.30 + Severity×0.20 + Tier×0.15</p>
          </div>
          {sessionId && (
            <Link href={`/dashboard/${sessionId}`} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Full Dashboard →
            </Link>
          )}
        </div>
        <div className="space-y-3">
          {issues.slice(0, 10).map((cluster, i) => (
            <IssueRow
              key={cluster.id || cluster.issue_key}
              cluster={cluster}
              businessId={businessId}
              rank={i + 1}
              sessionId={sessionId || ""}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
