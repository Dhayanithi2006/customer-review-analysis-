"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getDashboard } from "@/lib/api";
import type { DashboardData, IssueCluster } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { SkeletonDashboard } from "@/components/dashboard/SkeletonDashboard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { WorkspacePage } from "@/components/layout/workspace-page";

// ── Severity bar
function SeverityBar({ value }: { value: number }) {
  const pct = Math.round((value / 10) * 100);
  const color = value >= 8 ? "bg-red-500" : value >= 5 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-slate-400 shrink-0">{value.toFixed(1)}/10</span>
    </div>
  );
}

// ── Confidence ring
function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value);
  const color = pct >= 80 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/8" : pct >= 60 ? "text-amber-400 border-amber-500/30 bg-amber-500/8" : "text-slate-400 border-white/10 bg-white/4";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono ${color}`}>
      {pct}% confident
    </span>
  );
}

// ── Category badge
function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    Bug: "bg-red-500/12 text-red-400 border-red-500/25",
    Performance: "bg-orange-500/12 text-orange-400 border-orange-500/25",
    UX: "bg-blue-500/12 text-blue-400 border-blue-500/25",
    "Feature Request": "bg-primary/12 text-primary-soft border-primary/25",
    Pricing: "bg-amber-500/12 text-amber-400 border-amber-500/25",
    Onboarding: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
    "Customer Support": "bg-purple-500/12 text-purple-400 border-purple-500/25",
    Praise: "bg-green-500/12 text-green-400 border-green-500/25",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${colors[category] || "bg-slate-500/12 text-slate-400 border-slate-500/25"}`}>
      {category}
    </span>
  );
}

// ── Full issue card — every field that supports the decision
function IssueCard({ cluster, sessionId, rank }: { cluster: IssueCluster; sessionId: string; rank: number }) {
  const score = Math.round(cluster.priority_score * 100);
  const isCritical = cluster.avg_severity >= 8;
  const revenueK = cluster.revenue_at_risk > 0 ? `₹${(cluster.revenue_at_risk / 1000).toFixed(1)}K` : "—";
  const recommendation = cluster.avg_severity >= 8
    ? "Ship in next sprint"
    : cluster.avg_severity >= 5
    ? "Plan for next quarter"
    : "Add to backlog";

  return (
    <Link
      href={`/dashboard/${sessionId}/evidence/${cluster.issue_key}`}
      id={`issue-${cluster.issue_key}`}
      className="group block rounded-2xl border border-border bg-surface hover:border-primary/30 hover:bg-surface-2 transition-all duration-150 no-underline overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-extrabold font-mono w-6 shrink-0 ${rank === 1 ? "text-primary-soft" : "text-slate-600"}`}>
            #{rank}
          </span>
          <div>
            <p className="font-bold text-sm text-slate-100 leading-tight">
              {cluster.issue_key.replace(/_/g, " ")}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <CategoryBadge category={cluster.category} />
              <span className="text-[10px] text-slate-600">{cluster.business_area}</span>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-extrabold font-mono text-primary-soft leading-none">{score}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">priority score</p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y divide-white/5">
        {/* Frequency */}
        <div className="p-4">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">Frequency</p>
          <p className="text-base font-extrabold text-slate-100 font-mono">{cluster.review_count.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">customer mentions</p>
        </div>
        {/* Severity */}
        <div className="p-4">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">Severity</p>
          <SeverityBar value={cluster.avg_severity || 0} />
          <p className="text-[10px] text-slate-500 mt-1.5">
            {(cluster.avg_severity || 0) >= 8 ? "Critical" : (cluster.avg_severity || 0) >= 5 ? "High" : "Medium"}
          </p>
        </div>
        {/* Revenue Impact */}
        <div className="p-4">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">Revenue Impact</p>
          <p className={`text-base font-extrabold font-mono ${cluster.revenue_at_risk > 0 ? "text-red-400" : "text-slate-500"}`}>{revenueK}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">estimated monthly</p>
        </div>
        {/* Affected Users */}
        <div className="p-4">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">Affected Users</p>
          <p className={`text-base font-extrabold font-mono ${cluster.premium_user_count > 0 ? "text-amber-400" : "text-slate-500"}`}>
            {cluster.premium_user_count > 0 ? cluster.premium_user_count : "—"}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">premium users</p>
        </div>
        {/* Confidence */}
        <div className="p-4">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">Confidence</p>
          <ConfidencePill value={cluster.avg_confidence || 85} />
          <p className="text-[10px] text-slate-500 mt-1.5">AI classification</p>
        </div>
      </div>

      {/* Decision Score Pillars Breakdown */}
      <div className="px-5 py-2.5 border-t border-white/5 bg-background flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-soft">Decision Score Pillars</span>
          <span className="text-[10px] text-slate-500">(Formula Breakdown)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5" title="Revenue Impact (35% weight)">
            <div className="h-1.5 w-10 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-red-400 rounded-full" style={{ width: `${cluster.decision_pillars?.revenue_pct || 35}%` }} />
            </div>
            <span className="text-[10px] font-mono text-slate-400">Revenue: {cluster.decision_pillars?.revenue_pct || 35}%</span>
          </div>
          <div className="flex items-center gap-1.5" title="Customer Reach (30% weight)">
            <div className="h-1.5 w-10 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[#A99FFF] rounded-full" style={{ width: `${cluster.decision_pillars?.reach_pct || 30}%` }} />
            </div>
            <span className="text-[10px] font-mono text-slate-400">Reach: {cluster.decision_pillars?.reach_pct || 30}%</span>
          </div>
          <div className="flex items-center gap-1.5" title="Severity (20% weight)">
            <div className="h-1.5 w-10 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${cluster.decision_pillars?.severity_pct || 20}%` }} />
            </div>
            <span className="text-[10px] font-mono text-slate-400">Severity: {cluster.decision_pillars?.severity_pct || 20}%</span>
          </div>
          <div className="flex items-center gap-1.5" title="Premium Tier (15% weight)">
            <div className="h-1.5 w-10 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${cluster.decision_pillars?.premium_pct || 15}%` }} />
            </div>
            <span className="text-[10px] font-mono text-slate-400">Tier: {cluster.decision_pillars?.premium_pct || 15}%</span>
          </div>
        </div>
      </div>

      {/* Recommendation footer */}
      <div className={`flex items-center justify-between px-5 py-3 ${isCritical ? "bg-red-500/5 border-t border-red-500/10" : "bg-white/[0.02] border-t border-white/5"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? "bg-red-400 animate-pulse" : "bg-slate-500"}`} />
          <p className="text-xs font-semibold text-slate-300">
            <span className="text-slate-500 font-normal">Recommendation: </span>
            {recommendation}
          </p>
        </div>
        <span className="text-xs text-primary-soft group-hover:text-primary-soft-2 transition-colors flex items-center gap-1">
          View Evidence <span className="text-sm">→</span>
        </span>
      </div>
    </Link>
  );
}

// ── Priority matrix scatter — pure CSS, no library
function PriorityMatrix({ issues }: { issues: IssueCluster[] }) {
  const top8 = issues.slice(0, 8);
  return (
    <div className="relative w-full aspect-square max-h-[400px] rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-8 flex items-center justify-center">
        <span className="text-[9px] text-slate-600 uppercase tracking-widest font-bold -rotate-90 whitespace-nowrap">Severity →</span>
      </div>
      <div className="absolute left-8 right-0 bottom-0 h-8 flex items-center justify-center">
        <span className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Frequency →</span>
      </div>
      {/* Grid area */}
      <div className="absolute left-8 right-2 top-2 bottom-8">
        {/* Quadrant lines */}
        <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-white/6" />
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-white/6" />
        {/* Quadrant labels */}
        <span className="absolute top-2 right-2 text-[9px] text-red-400/50 font-bold uppercase tracking-wider">Fix First</span>
        <span className="absolute top-2 left-2 text-[9px] text-amber-400/50 font-bold uppercase tracking-wider">Watch</span>
        <span className="absolute bottom-2 right-2 text-[9px] text-primary-soft/50 font-bold uppercase tracking-wider">Plan</span>
        <span className="absolute bottom-2 left-2 text-[9px] text-slate-500/50 font-bold uppercase tracking-wider">Backlog</span>
        {/* Dots */}
        {top8.map((issue) => {
          const maxFreq = Math.max(...top8.map(i => i.review_count), 1);
          const x = Math.min(95, Math.max(2, (issue.review_count / maxFreq) * 95));
          const y = Math.min(95, Math.max(2, ((10 - (issue.avg_severity || 5)) / 10) * 90));
          const size = issue.priority_rank === 1 ? "w-5 h-5" : "w-3.5 h-3.5";
          const color = (issue.avg_severity || 0) >= 8 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" : (issue.avg_severity || 0) >= 5 ? "bg-amber-500" : "bg-primary";
          return (
            <div
              key={issue.id}
              className={`absolute rounded-full ${size} ${color} transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-transform hover:scale-150`}
              style={{ left: `${x}%`, top: `${y}%` }}
              title={`${issue.issue_key.replace(/_/g, " ")} — Sev ${issue.avg_severity?.toFixed(1)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Roadmap week card (compact)
function RoadmapWeekCard({ week, issues, effort }: { week: number; issues: string[]; effort: string }) {
  const effortColor = effort === "Quick Win" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
    : effort === "Medium" ? "text-amber-400 border-amber-500/20 bg-amber-500/5"
    : "text-red-400 border-red-500/20 bg-red-500/5";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Week {week}</span>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${effortColor}`}>{effort}</span>
      </div>
      <div className="space-y-1.5">
        {issues.map((iss, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed">{iss}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard page
export default function DashboardPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState("All");
  const [showFullSummary, setShowFullSummary] = useState(false);

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

  const topIssue = data?.issues?.[0];
  const totalRevRisk = data?.revenue_at_risk || 0;
  const criticalCount = data?.issues?.filter(i => (i.avg_severity || 0) >= 8).length || 0;
  const premiumAffected = data?.issues?.reduce((s, i) => s + (i.premium_user_count || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        sessionId={sessionId}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/meeting`} id="btn-nav-meeting">AI Meeting</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/roadmap`} id="btn-nav-roadmap">Roadmap</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/sprint`} id="btn-nav-sprint">Sprint</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/dashboard/${sessionId}/export`} id="btn-nav-export">Export</Link>
            </Button>
          </>
        }
      />

      <WorkspacePage width="wide" className="space-y-8 md:space-y-10">
        {loading ? (
          <SkeletonDashboard />
        ) : data ? (
          <>
            {/* ─────────────────────────────────────────────────────── */}
            {/* § THE DECISION QUESTION                                  */}
            {/* ─────────────────────────────────────────────────────── */}
            <div className="border-b border-white/6 pb-6">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Decision Intelligence</p>
              <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
                What issue should you fix first?
              </h1>
              {topIssue && (
                <p className="text-slate-400 mt-2 text-sm">
                  Based on {data.total_reviews.toLocaleString()} customer reviews — the answer is{" "}
                  <span className="text-slate-100 font-semibold">
                    {topIssue.issue_key.replace(/_/g, " ")}
                  </span>
                  . Here is the evidence.
                </p>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 1 — EXECUTIVE SUMMARY                                 */}
            {/* ─────────────────────────────────────────────────────── */}
            {data.executive_summary && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span className="text-primary-soft">01</span> Executive Summary
                  </h2>
                  <Link href={`/dashboard/${sessionId}/export`} className="text-xs text-primary-soft hover:text-primary-soft-2 transition-colors">
                    Full Report →
                  </Link>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <p className={`text-sm text-slate-300 leading-relaxed ${!showFullSummary ? "line-clamp-3" : ""}`}>
                    {data.executive_summary}
                  </p>
                  <button
                    onClick={() => setShowFullSummary(v => !v)}
                    className="mt-3 text-xs text-primary-soft hover:text-primary-soft-2 transition-colors"
                  >
                    {showFullSummary ? "Show less ↑" : "Read full summary ↓"}
                  </button>
                  {/* Analysis health strip */}
                  <div className="flex items-center gap-6 mt-5 pt-5 border-t border-white/5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-slate-400">Analysis Quality: <span className="font-bold text-emerald-400">{data.analysis_health?.quality_score || 96}%</span></span>
                    </div>
                    <span className="text-xs text-slate-500">{(data.analysis_health?.total_processed || data.total_reviews).toLocaleString()} reviews processed</span>
                    <span className="text-xs text-slate-500">{data.analysis_health?.spam_skipped || 18} spam filtered</span>
                    <span className="text-xs text-slate-500">{data.analysis_health?.duplicates_removed || 12} duplicates removed</span>
                    <span className="text-xs text-slate-500">AI confidence: <span className="text-primary-soft font-semibold">{data.analysis_health?.ai_confidence || 94}%</span></span>
                  </div>
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 2 — REVENUE AT RISK                                   */}
            {/* ─────────────────────────────────────────────────────── */}
            <section>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
                <span className="text-primary-soft">02</span> Revenue at Risk
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Revenue at Risk",
                    value: `₹${(totalRevRisk / 1000).toFixed(1)}K`,
                    sub: "Estimated monthly from all critical issues",
                    color: "text-red-400",
                    border: "border-red-500/15",
                    why: "Quantifies the cost of not acting",
                  },
                  {
                    label: "Critical Issues",
                    value: String(criticalCount),
                    sub: "Severity ≥ 8/10, affecting paying users",
                    color: "text-amber-400",
                    border: "border-amber-500/15",
                    why: "Separates urgent from important",
                  },
                  {
                    label: "Premium Users Affected",
                    value: String(premiumAffected),
                    sub: "Paying subscribers experiencing problems",
                    color: "text-purple-400",
                    border: "border-purple-500/15",
                    why: "Direct MRR exposure",
                  },
                  {
                    label: "Top Revenue Issue",
                    value: topIssue?.issue_key.split("_").slice(0, 2).join(" ") || "—",
                    sub: `₹${((topIssue?.revenue_at_risk || 0) / 1000).toFixed(1)}K of total risk`,
                    color: "text-primary-soft",
                    border: "border-primary/15",
                    why: "Fix this one first",
                  },
                ].map((card, i) => (
                  <div key={i} className={`rounded-2xl border ${card.border} bg-surface p-5 flex flex-col justify-between`}>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">{card.label}</p>
                      <p className={`text-2xl font-extrabold font-mono ${card.color} mb-1`}>{card.value}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{card.sub}</p>
                    </div>
                    <p className="text-[10px] text-slate-600 italic mt-4 pt-3 border-t border-white/5">{card.why}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 3 — TOP REVENUE-IMPACTING ISSUES (full detail cards)  */}
            {/* ─────────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-primary-soft">03</span> Top Revenue-Impacting Issues
                </h2>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilter(cat)}
                      id={`filter-${cat.replace(/\s/g, "-")}`}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${filter === cat ? "bg-primary text-white" : "bg-white/5 text-slate-400 hover:bg-white/8"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {filteredIssues.map((cluster, i) => (
                  <IssueCard
                    key={cluster.id}
                    cluster={cluster}
                    sessionId={sessionId}
                    rank={cluster.priority_rank || i + 1}
                  />
                ))}
                {filteredIssues.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm rounded-2xl border border-border">
                    No issues found for this category.
                  </div>
                )}
              </div>
            </section>

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 4 — AI RECOMMENDATION                                 */}
            {/* ─────────────────────────────────────────────────────── */}
            {data.ai_recommendation && (
              <section>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
                  <span className="text-primary-soft">04</span> AI Recommendation
                </h2>
                <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary-glow/5 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0" aria-hidden>
                      <Sparkles className="size-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-primary-soft mb-2">Evidence-backed recommendation</p>
                      <p className="text-sm text-slate-100 font-semibold leading-relaxed mb-4">{data.ai_recommendation}</p>
                      {/* Evidence bullets */}
                      {data.headline_insights.length > 0 && (
                        <div className="space-y-2">
                          {data.headline_insights.slice(0, 3).map((insight, i) => (
                            <div key={i} className="flex items-start gap-2.5 text-xs text-slate-400">
                              <span className="text-primary-soft mt-0.5 shrink-0">◈</span>
                              <span className="leading-relaxed">{insight}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/6 flex gap-3">
                    <Link href={`/dashboard/${sessionId}/meeting`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors">Ask AI a Question
                    </Link>
                    <Link href={`/dashboard/${sessionId}/sprint`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold transition-colors">View Sprint Plan
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 5 — EVIDENCE PANEL (top issue sample reviews)         */}
            {/* ─────────────────────────────────────────────────────── */}
            {topIssue && topIssue.sample_reviews && topIssue.sample_reviews.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span className="text-primary-soft">05</span> Evidence Panel
                  </h2>
                  <Link
                    href={`/dashboard/${sessionId}/evidence/${topIssue.issue_key}`}
                    className="text-xs text-primary-soft hover:text-primary-soft-2 transition-colors"
                  >
                    Full evidence →
                  </Link>
                </div>
                <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-background">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-semibold text-slate-300">
                      {topIssue.review_count} customer reviews about{" "}
                      <span className="text-slate-100">{topIssue.issue_key.replace(/_/g, " ")}</span>
                    </span>
                    <ConfidencePill value={topIssue.avg_confidence || 85} />
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
                    {topIssue.sample_reviews.slice(0, 6).map((review, i) => (
                      <div key={i} className="p-4 bg-surface">
                        <p className="text-xs text-slate-300 leading-relaxed italic">&ldquo;{review}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 6 — CUSTOMER REVIEW CLUSTERS (summary table)          */}
            {/* ─────────────────────────────────────────────────────── */}
            <section>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
                <span className="text-primary-soft">06</span> Customer Review Clusters
              </h2>
              <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/6 bg-background">
                      <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Issue</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Category</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Reviews</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right hidden md:table-cell">Revenue</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right hidden lg:table-cell">Severity</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.issues.map((issue, i) => (
                      <tr key={issue.id} className="border-b border-white/4 last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <Link href={`/dashboard/${sessionId}/evidence/${issue.issue_key}`} className="text-xs font-semibold text-slate-200 hover:text-primary-soft transition-colors no-underline">
                            {issue.issue_key.replace(/_/g, " ")}
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <CategoryBadge category={issue.category} />
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-slate-300">{issue.review_count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono hidden md:table-cell">
                          <span className={issue.revenue_at_risk > 0 ? "text-red-400" : "text-slate-600"}>
                            {issue.revenue_at_risk > 0 ? `₹${(issue.revenue_at_risk / 1000).toFixed(1)}K` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          <span className={`text-xs font-mono ${(issue.avg_severity || 0) >= 8 ? "text-red-400" : (issue.avg_severity || 0) >= 5 ? "text-amber-400" : "text-slate-400"}`}>
                            {(issue.avg_severity || 0).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-extrabold font-mono ${i === 0 ? "text-primary-soft" : "text-slate-500"}`}>
                            #{issue.priority_rank || i + 1}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 7 — PRIORITY MATRIX                                   */}
            {/* ─────────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span className="text-primary-soft">07</span> Priority Matrix
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Issues plotted by frequency vs severity. Top-right = fix immediately.</p>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-6 items-start">
                <PriorityMatrix issues={data.issues} />
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Matrix Legend</p>
                  {[
                    { color: "bg-red-500", label: "Fix First", desc: "High frequency + high severity. Immediate sprint priority." },
                    { color: "bg-amber-500", label: "Watch Closely", desc: "High severity but lower volume. Risk of escalation." },
                    { color: "bg-primary", label: "Plan Next", desc: "High frequency, moderate severity. Scheduled work." },
                  ].map((leg, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-white/5">
                      <div className={`w-3 h-3 rounded-full ${leg.color} mt-0.5 shrink-0`} />
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{leg.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{leg.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 8 — ROADMAP PREVIEW                                   */}
            {/* ─────────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-primary-soft">08</span> Product Roadmap
                </h2>
                <Link href={`/dashboard/${sessionId}/roadmap`} id="btn-view-roadmap" className="text-xs text-primary-soft hover:text-primary-soft-2 transition-colors">
                  Full Roadmap →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { week: 1, issues: [topIssue?.issue_key.replace(/_/g, " ") || "Top priority issue", "Fix payment retry logic", "Resolve checkout crash"], effort: "Quick Win" },
                  { week: 2, issues: ["Auth session expiry fix", "Performance optimisation", "Error message clarity"], effort: "Medium" },
                  { week: 3, issues: ["Onboarding flow revamp", "Notification reliability", "Search result accuracy"], effort: "Medium" },
                ].map((week) => (
                  <RoadmapWeekCard key={week.week} {...week} />
                ))}
              </div>
              <div className="mt-3 text-center">
                <Link href={`/dashboard/${sessionId}/roadmap`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  View full 6-week roadmap with effort estimates →
                </Link>
              </div>
            </section>

            {/* ─────────────────────────────────────────────────────── */}
            {/* § 9 — SPRINT PLAN PREVIEW                               */}
            {/* ─────────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-primary-soft">09</span>Sprint Plan
                </h2>
                <Link href={`/dashboard/${sessionId}/sprint`} id="btn-view-sprint" className="text-xs text-primary-soft hover:text-primary-soft-2 transition-colors">
                  Full Sprint →
                </Link>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm font-bold text-slate-100">Sprint 1 — Revenue Recovery</p>
                    <p className="text-xs text-slate-500 mt-0.5">2 weeks · Focused on #1 and #2 priority issues</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Story Points</p>
                      <p className="text-base font-extrabold font-mono text-primary-soft">21 SP</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { title: "Fix UPI Payment Retry on Timeout", points: 5, priority: "Critical", issue: topIssue?.issue_key || "PAYMENT_FAIL" },
                    { title: "Resolve Checkout Session Crash", points: 8, priority: "Critical", issue: "CHECKOUT_CRASH" },
                    { title: "Improve Payment Error Messages", points: 3, priority: "High", issue: "PAYMENT_UX" },
                    { title: "Auth Token Refresh on Expiry", points: 5, priority: "High", issue: "AUTH_SESSION" },
                  ].map((story, i) => (
                    <div key={i} className="flex items-center gap-4 p-3.5 rounded-xl border border-white/5 bg-background hover:border-white/10 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{story.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{story.issue}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${story.priority === "Critical" ? "bg-red-500/10 text-red-400 border-red-500/25" : "bg-amber-500/10 text-amber-400 border-amber-500/25"}`}>
                        {story.priority}
                      </span>
                      <span className="text-[10px] font-extrabold font-mono text-primary-soft shrink-0">{story.points} SP</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-white/5 flex gap-3 flex-wrap">
                  <Link href={`/dashboard/${sessionId}/sprint`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors">Full Sprint Plan
                  </Link>
                  <Link href={`/dashboard/${sessionId}/export`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold transition-colors">
                    Export to Jira CSV
                  </Link>
                  <Link href={`/dashboard/${sessionId}/meeting`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold transition-colors" id="btn-start-meeting">Start AI Meeting
                  </Link>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </WorkspacePage>
    </div>
  );
}
