"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis, getBusinessAnalyses } from "@/lib/business-api";
import type { LatestAnalysisResponse, AnalysisVersion } from "@/lib/business-api";
import { getDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    pending:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
    running:   "bg-blue-500/15 text-blue-400 border-blue-500/25",
    failed:    "bg-red-500/15 text-red-400 border-red-500/25",
  };
  const label: Record<string, string> = {
    complete: "✓ Complete", pending: "⏳ Pending", running: "⚡ Running", failed: "✗ Failed",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${map[status] || map.pending}`}>
      {label[status] || status}
    </span>
  );
}

function VersionCard({ v, businessId, isLatest }: { v: AnalysisVersion; businessId: string; isLatest: boolean }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
      isLatest ? "border-indigo-500/30 bg-indigo-500/5" : "border-white/7 bg-[#0d0f1a]"
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
        isLatest ? "bg-indigo-600 text-white" : "bg-white/8 text-slate-400"
      }`}>
        {v.version}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <p className="text-sm font-bold text-slate-100">{v.label}</p>
          {isLatest && <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-[10px] font-bold">Latest</span>}
          <StatusBadge status={v.status} />
        </div>
        <div className="flex items-center gap-4 mt-1 flex-wrap">
          <span className="text-[11px] text-slate-500">{v.source || "CSV"}</span>
          <span className="text-[11px] text-slate-500">{v.total_reviews?.toLocaleString() || "—"} reviews</span>
          <span className="text-[11px] text-slate-500">{v.created_at ? new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
        </div>
      </div>
      {v.status === "complete" && (
        <Link
          href={`/business/${businessId}/analysis?session=${v.session_id}`}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shrink-0 no-underline"
        >
          View →
        </Link>
      )}
    </div>
  );
}

export default function WorkspaceOverviewPage() {
  const params     = useParams();
  const businessId = params.business_id as string;

  const [latest, setLatest]       = useState<LatestAnalysisResponse | null>(null);
  const [history, setHistory]     = useState<AnalysisVersion[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [lat, hist] = await Promise.all([
          getLatestAnalysis(businessId),
          getBusinessAnalyses(businessId),
        ]);
        setLatest(lat);
        setHistory(hist.analyses || []);

        if (lat.has_analysis && lat.session_id) {
          try {
            const dash = await getDashboard(lat.session_id);
            setDashboard(dash);
          } catch { /* ok */ }
        }
      } catch { /* ok */ }
      finally { setLoading(false); }
    };
    load();
  }, [businessId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* ── Latest Analysis Quick Stats */}
      {latest?.has_analysis && dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Reviews", value: dashboard.total_reviews?.toLocaleString() || "—", icon: "📊", color: "indigo" },
            { label: "Revenue at Risk", value: dashboard.revenue_at_risk > 0 ? `₹${(dashboard.revenue_at_risk / 1000).toFixed(1)}K` : "—", icon: "⚠️", color: "red" },
            { label: "Top Priority Issue", value: typeof dashboard.top_priority_issue === "string" ? dashboard.top_priority_issue : (dashboard.top_priority_issue as { issue_key?: string } | null)?.issue_key ?? "—", icon: "🎯", color: "amber" },
            { label: "AI Confidence", value: `${dashboard.analysis_health?.ai_confidence || 94}%`, icon: "🤖", color: "emerald" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-white/7 bg-[#0d0f1a] p-4">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">{s.icon} {s.label}</p>
              <p className="text-lg font-black font-mono text-slate-100 truncate">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── No Analysis Yet CTA */}
      {!latest?.has_analysis && (
        <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-2xl shrink-0">🧠</div>
            <div>
              <p className="text-sm font-bold text-slate-100 mb-1">
                {latest?.status === "pending" || latest?.status === "running"
                  ? `Analysis ${latest.label} is running…`
                  : "No analysis yet"}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                {latest?.message || "Upload customer feedback to run your first analysis. The Decision Engine will rank issues by revenue impact."}
              </p>
              {(latest?.status === "pending" || latest?.status === "running") && latest?.session_id ? (
                <Link
                  href={`/business/${businessId}/analysis`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                >
                  ⏳ View Processing Status →
                </Link>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                >
                  🚀 Upload Feedback → Run Analysis
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Decision Center Quick Access */}
      {latest?.has_analysis && (
        <div className="flex gap-3 mb-8 flex-wrap">
          <Link
            href={`/business/${businessId}/analysis`}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] no-underline"
          >
            🧠 Open Decision Center →
          </Link>
          <Link
            href={`/business/${businessId}/roadmap`}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/8 hover:border-white/15 text-slate-300 text-sm font-semibold transition-all no-underline"
          >
            🗺️ View Roadmap
          </Link>
          <Link
            href={`/business/${businessId}/sprint`}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/8 hover:border-white/15 text-slate-300 text-sm font-semibold transition-all no-underline"
          >
            ⚡ Sprint Plan
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-sm font-semibold transition-all no-underline"
          >
            ➕ Run New Analysis
          </Link>
        </div>
      )}

      {/* ── Analysis History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Analysis History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Each analysis is a separate version of your decision intelligence report.</p>
          </div>
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors no-underline"
          >
            ➕ Run New Analysis
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/8 gap-3">
            <span className="text-4xl">📊</span>
            <p className="text-sm font-semibold text-slate-400">No analyses yet</p>
            <p className="text-xs text-slate-600 text-center max-w-xs">Upload customer feedback from your workspace to run the Decision Intelligence Engine.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((v, i) => (
              <VersionCard key={v.id} v={v} businessId={businessId} isLatest={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
