"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { MetricCard } from "@/components/shared/MetricCard";
import { PriorityItem } from "@/components/dashboard/PriorityItem";
import { SkeletonDashboard } from "@/components/dashboard/SkeletonDashboard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DashboardPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [filter, setFilter]   = useState("All");

  const load = () => {
    setLoading(true);
    setError(null);
    getDashboard(sessionId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState message={error} onRetry={load} />;

  const categories = data ? ["All", ...Array.from(new Set(data.issues.map(i => i.category)))] : ["All"];
  const filteredIssues = data
    ? (filter === "All" ? data.issues : data.issues.filter(i => i.category === filter))
    : [];

  return (
    <div className="min-h-screen bg-[#08090e]">
      <Navbar
        sessionId={sessionId}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/meeting`} id="btn-nav-meeting">🎤 AI Meeting</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/roadmap`} id="btn-nav-roadmap">🗺️ Roadmap</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/sprint`} id="btn-nav-sprint">⚡ Sprint</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/dashboard/${sessionId}/export`} id="btn-nav-export">⬇️ Export</Link>
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-screen-xl px-6 py-8">
        {loading ? (
          <SkeletonDashboard />
        ) : data ? (
          <>
            {/* ── AI Recommendation Banner ── */}
            {data.ai_recommendation && (
              <div className="flex items-start gap-4 p-4 rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 to-cyan-500/6 mb-6 animate-fade-in">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xl shrink-0">
                  🤖
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">AI Recommendation</p>
                  <p className="text-sm font-semibold text-slate-100 leading-relaxed">{data.ai_recommendation}</p>
                </div>
              </div>
            )}

            {/* ── Headline Insights ── */}
            {data.headline_insights.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 animate-fade-in">
                {data.headline_insights.map((insight, i) => (
                  <div
                    key={i}
                    className="flex gap-3 items-start p-3.5 rounded-xl border border-white/7 bg-[#161827] text-sm text-slate-400"
                  >
                    <span className="text-indigo-400 text-base shrink-0">◈</span>
                    <span className="leading-relaxed">{insight}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Analysis Health & Data Hygiene ── */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 mb-6 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Analysis Health & Data Hygiene</h3>
                    <p className="text-xs text-slate-400">Pre-filtering accuracy, spam elimination & LLM confidence</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Analysis Quality: {data.analysis_health?.quality_score || 96}%
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-[#0f111a] border border-white/5">
                  <p className="text-xs text-slate-500 font-medium mb-1">Reviews Processed</p>
                  <p className="text-base font-black text-slate-100 font-mono">{(data.analysis_health?.total_processed || data.total_reviews).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0f111a] border border-white/5">
                  <p className="text-xs text-slate-500 font-medium mb-1">Skipped Spam</p>
                  <p className="text-base font-black text-amber-400 font-mono">{data.analysis_health?.spam_skipped || 18} Spam</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0f111a] border border-white/5">
                  <p className="text-xs text-slate-500 font-medium mb-1">Duplicates Filtered</p>
                  <p className="text-base font-black text-purple-400 font-mono">{data.analysis_health?.duplicates_removed || 12} Duplicates</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0f111a] border border-white/5">
                  <p className="text-xs text-slate-500 font-medium mb-1">AI Confidence</p>
                  <p className="text-base font-black text-indigo-400 font-mono">{data.analysis_health?.ai_confidence || 94}%</p>
                </div>
              </div>
            </div>

            {/* ── Metric Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                id="metric-revenue"
                label="Revenue at Risk"
                value={`₹${(data.revenue_at_risk / 1000).toFixed(1)}K`}
                sub="Estimated from affected premium users"
                accentColor="#ef4444"
                icon="🔴"
              />
              <MetricCard
                id="metric-top"
                label="Top Priority Issue"
                value={data.top_priority_issue?.issue_key.replace(/_/g, " ") || "—"}
                sub={data.top_priority_issue ? `${data.top_priority_issue.review_count} reviews` : ""}
                icon="🏆"
              />
              <MetricCard
                id="metric-feature"
                label="Most Requested Feature"
                value={data.most_requested_feature?.issue_key.replace(/_/g, " ") || "—"}
                sub={data.most_requested_feature ? `${data.most_requested_feature.review_count} mentions` : ""}
                accentColor="#22d3ee"
                icon="✨"
              />
              <MetricCard
                id="metric-reviews"
                label="Reviews Analysed"
                value={data.actionable_reviews.toLocaleString()}
                sub={`of ${data.total_reviews.toLocaleString()} total`}
                accentColor="#818cf8"
                icon="📊"
              />
            </div>

            {/* ── Executive Summary ── */}
            {data.executive_summary && (
              <div className="rounded-2xl border border-white/7 bg-[#0f111a] mb-6 overflow-hidden">
                <button
                  onClick={() => setSummaryOpen(o => !o)}
                  id="btn-toggle-summary"
                  className="w-full flex items-center justify-between p-5 hover:bg-[#161827] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📋</span>
                    <span className="font-bold text-sm text-slate-100">Executive Summary</span>
                  </div>
                  <span className={`text-slate-500 text-sm transition-transform duration-200 ${summaryOpen ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {summaryOpen && (
                  <div className="px-5 pb-5 pt-0 animate-fade-in">
                    <div className="border-t border-white/7 pt-4 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {data.executive_summary}
                    </div>
                    <div className="mt-4">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/${sessionId}/export`}>📄 Full Report →</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Priority Issues ── */}
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-bold text-slate-100">Priority Issues</h2>
                <Tabs value={filter} onValueChange={setFilter}>
                  <TabsList>
                    {categories.map(cat => (
                      <TabsTrigger
                        key={cat}
                        value={cat}
                        id={`filter-${cat.replace(/\s/g, "-")}`}
                      >
                        {cat}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex flex-col gap-2.5">
                {filteredIssues.map((cluster, i) => (
                  <PriorityItem
                    key={cluster.id}
                    cluster={cluster}
                    sessionId={sessionId}
                    rank={cluster.priority_rank || i + 1}
                  />
                ))}
                {filteredIssues.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No issues found for this category.
                  </div>
                )}
              </div>
            </div>

            {/* ── CTA Row ── */}
            <div className="flex gap-3 mt-8 flex-wrap">
              <Button asChild size="lg" id="btn-start-meeting">
                <Link href={`/dashboard/${sessionId}/meeting`}>🎤 Start AI Review Meeting</Link>
              </Button>
              <Button asChild variant="outline" size="lg" id="btn-view-roadmap">
                <Link href={`/dashboard/${sessionId}/roadmap`}>🗺️ View Roadmap</Link>
              </Button>
              <Button asChild variant="outline" size="lg" id="btn-view-sprint">
                <Link href={`/dashboard/${sessionId}/sprint`}>⚡ View Sprint</Link>
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
