"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis } from "@/lib/business-api";
import { getDashboard, getRoadmap, getSprint } from "@/lib/api";
import type { DashboardData, IssueCluster } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";
import { WorkspacePage } from "@/components/layout/workspace-page";

/* ── helpers ───────────────────────────────────────────────────────────── */

function formatRisk(value: number) {
  if (!value || value <= 0) return "—";
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value).toLocaleString()}`;
}

function issueTitle(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimateEffort(issue: IssueCluster): "S" | "M" | "L" {
  const sev = issue.avg_severity || 0;
  const volume = issue.review_count || 0;
  if (sev >= 8 || volume >= 300) return "L";
  if (sev >= 5 || volume >= 80) return "M";
  return "S";
}

function effortLabel(e: "S" | "M" | "L") {
  return { S: "Small · Quick win", M: "Medium · 1 sprint", L: "Large · Cross-team" }[e];
}

function priorityLabel(rank: number, severity: number) {
  if (rank === 1 || severity >= 8) return "Critical";
  if (rank <= 3 || severity >= 6) return "High";
  if (rank <= 6) return "Medium";
  return "Low";
}

function priorityVariant(label: string): "danger" | "warning" | "primary" | "default" {
  if (label === "Critical") return "danger";
  if (label === "High") return "warning";
  if (label === "Medium") return "primary";
  return "default";
}

function recommendationFor(issue: IssueCluster, rank: number, aiRec?: string) {
  if (rank === 1 && aiRec) return aiRec;
  if (issue.description) return issue.description;
  return `Prioritize fixing ${issueTitle(issue.issue_key)} — ${issue.category.toLowerCase()} in ${issue.business_area}.`;
}

function highlightKeywords(text: string, keywords: string[]) {
  if (!keywords.length) return [{ text, hit: false }];
  const escaped = keywords
    .filter(Boolean)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  if (!escaped.length) return [{ text, hit: false }];
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part) => ({
    text: part,
    hit: escaped.some((k) => part.toLowerCase() === k.toLowerCase()),
  }));
}

function keywordsFromIssue(issue: IssueCluster) {
  const fromKey = issue.issue_key
    .split("_")
    .filter((w) => w.length > 3)
    .map((w) => w.toLowerCase());
  const extras = [issue.category, issue.business_area]
    .filter(Boolean)
    .flatMap((s) => s.split(/\s+/))
    .filter((w) => w.length > 3)
    .map((w) => w.toLowerCase());
  return Array.from(new Set([...fromKey, ...extras])).slice(0, 8);
}

interface RoadmapWeekLite {
  week: number;
  theme: string;
  tasks?: string[];
  issues?: string[];
  effort?: string;
  rationale?: string;
  outcome?: string;
}

interface StoryLite {
  title?: string;
  user_story?: string;
  description?: string;
  story_points?: number;
  priority?: string;
  linked_issue?: string;
  issue_key?: string;
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function DecisionCenterPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const businessId = params.business_id as string;
  const sessionParam = searchParams.get("session");

  const [sessionId, setSessionId] = useState<string | null>(sessionParam);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapWeekLite[]>([]);
  const [stories, setStories] = useState<StoryLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(true);

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
          setLabel(latest.label);
        }
        setSessionId(sid);

        const [dash, road, sprint] = await Promise.all([
          getDashboard(sid),
          getRoadmap(sid).catch(() => ({ roadmap: [] })),
          getSprint(sid).catch(() => ({ sprint: null })),
        ]);

        setDashboard(dash);
        setRoadmap((road.roadmap || []) as RoadmapWeekLite[]);

        const sprintData = sprint.sprint as unknown;
        let storyList: StoryLite[] = [];
        if (Array.isArray(sprintData)) storyList = sprintData as StoryLite[];
        else if (sprintData && typeof sprintData === "object") {
          storyList = (sprintData as { stories?: StoryLite[] }).stories || [];
        }
        setStories(storyList);

        const issues = dash.issues || [];
        if (issues[0]) setSelectedKey(issues[0].issue_key);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId, sessionParam]);

  const issues = useMemo(
    () => (dashboard?.issues || []) as IssueCluster[],
    [dashboard]
  );

  const topIssue = useMemo(() => {
    if (!dashboard) return null;
    if (dashboard.top_priority_issue && typeof dashboard.top_priority_issue !== "string") {
      return dashboard.top_priority_issue;
    }
    return issues[0] || null;
  }, [dashboard, issues]);

  const selected = useMemo(
    () => issues.find((i) => i.issue_key === selectedKey) || topIssue,
    [issues, selectedKey, topIssue]
  );

  if (loading) {
    return (
      <WorkspacePage>
        <ContentSkeleton variant="dashboard" />
      </WorkspacePage>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-2xl mx-auto">
        <div className="rounded-[20px] border border-white/[0.08] bg-surface p-8 md:p-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-3">
            Decision Center
          </p>
          <h2 className="text-xl font-extrabold text-white mb-2 tracking-tight">
            No briefing available
          </h2>
          <p className="text-sm text-slate-400 mb-7 leading-relaxed">
            {error || "Run an analysis to generate an executive decision brief."}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild>
              <Link href="/">Upload feedback</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/business/${businessId}`}>Back to workspace</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const confidence = dashboard.analysis_health?.ai_confidence ?? 94;
  const topEffort = topIssue ? estimateEffort(topIssue) : "M";
  const recoveryValue = formatRisk(dashboard.revenue_at_risk);
  const criticalIssues = issues.slice(0, 6);
  const keywords = selected ? keywordsFromIssue(selected) : [];

  return (
    <WorkspacePage>
      {/* Page framing — one question */}
      <div className="mb-8 md:mb-10">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-soft">
            Decision Center
          </p>
          {label && (
            <Badge variant="primary">{label}</Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white max-w-2xl leading-tight">
          What should this business fix first?
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-xl leading-relaxed">
          Executive brief ranked by revenue impact — not review volume alone.
        </p>
      </div>

      {/* ── 1. AI Executive Brief ─────────────────────────────────────── */}
      <section className="mb-12">
        <div className="rounded-[22px] border border-primary/25 bg-gradient-to-br from-primary/[0.12] via-[#111827] to-[#111827] p-6 md:p-9 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-soft-2 mb-4">
            AI Executive Brief
          </p>

          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-snug mb-3 max-w-3xl">
            {topIssue
              ? `Fix ${issueTitle(topIssue.issue_key)} first.`
              : "Review the ranked issues below."}
          </h2>

          {(dashboard.executive_summary || dashboard.ai_recommendation) && (
            <p className="text-sm md:text-[15px] text-slate-300 leading-relaxed max-w-3xl mb-8">
              {dashboard.executive_summary || dashboard.ai_recommendation}
            </p>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
            {[
              {
                label: "Revenue at risk",
                value: formatRisk(dashboard.revenue_at_risk),
                tone: "text-red-400",
                countTo:
                  dashboard.revenue_at_risk >= 1000
                    ? dashboard.revenue_at_risk /
                      (dashboard.revenue_at_risk >= 100000 ? 100000 : 1000)
                    : dashboard.revenue_at_risk || undefined,
                countPrefix: "₹",
                countSuffix:
                  dashboard.revenue_at_risk >= 100000
                    ? "L"
                    : dashboard.revenue_at_risk >= 1000
                    ? "K"
                    : "",
                countDecimals: dashboard.revenue_at_risk >= 1000 ? 1 : 0,
              },
              {
                label: "Most critical issue",
                value: topIssue ? issueTitle(topIssue.issue_key) : "—",
                tone: "text-white",
              },
              {
                label: "Expected recovery",
                value: recoveryValue === "—" ? "—" : `Up to ${recoveryValue}`,
                tone: "text-emerald-400",
              },
              {
                label: "Engineering effort",
                value: effortLabel(topEffort),
                tone: "text-amber-300",
              },
              {
                label: "Confidence",
                value: `${confidence}%`,
                tone: "text-primary-soft",
                countTo: confidence,
                countSuffix: "%",
              },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-2xl bg-black/25 border border-border p-4 min-h-[96px] flex flex-col justify-between hover-lift"
              >
                <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold">
                  {m.label}
                </p>
                <p
                  className={cn(
                    "text-sm md:text-base font-bold tracking-tight leading-snug mt-3 line-clamp-2",
                    m.tone
                  )}
                >
                  {typeof m.countTo === "number" ? (
                    <AnimatedCounter
                      value={m.countTo}
                      prefix={m.countPrefix || ""}
                      suffix={m.countSuffix || ""}
                      decimals={m.countDecimals || 0}
                    />
                  ) : (
                    m.value
                  )}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {topIssue && sessionId && (
              <Button asChild size="lg">
                <a href="#evidence">View Evidence</a>
              </Button>
            )}
            <Button asChild variant="secondary" size="lg">
              <Link href={`/business/${businessId}/sprint`}>Generate Sprint</Link>
            </Button>
            {topIssue && sessionId && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/dashboard/${sessionId}/evidence/${topIssue.issue_key}`}>
                  Full evidence trail
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Critical Issues ────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            Critical issues
          </p>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Ranked by business impact
          </h3>
        </div>

        <div className="grid gap-4">
          {criticalIssues.map((issue, idx) => {
            const rank = issue.priority_rank || idx + 1;
            const pri = priorityLabel(rank, issue.avg_severity || 0);
            const active = selectedKey === issue.issue_key;
            return (
              <button
                key={issue.id || issue.issue_key}
                type="button"
                onClick={() => {
                  setSelectedKey(issue.issue_key);
                  setEvidenceOpen(true);
                }}
                className={cn(
                  "text-left rounded-[20px] border p-5 md:p-6 transition-all duration-200",
                  "bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.24)]",
                  active
                    ? "border-primary/35 ring-1 ring-primary/20"
                    : "border-border hover:border-white/[0.12]"
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        #{String(rank).padStart(2, "0")}
                      </span>
                      <Badge variant={priorityVariant(pri)}>{pri}</Badge>
                      <Badge variant="outline">{issue.category}</Badge>
                    </div>
                    <h4 className="text-base md:text-lg font-bold text-white tracking-tight">
                      {issueTitle(issue.issue_key)}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">{issue.business_area}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">
                      Revenue risk
                    </p>
                    <p className="text-lg font-extrabold font-mono text-red-400 mt-1">
                      {formatRisk(issue.revenue_at_risk)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    {
                      label: "Affected customers",
                      value: String(
                        issue.premium_user_count > 0
                          ? issue.premium_user_count
                          : issue.review_count
                      ),
                    },
                    {
                      label: "Severity",
                      value: `${(issue.avg_severity || 0).toFixed(1)} / 10`,
                    },
                    {
                      label: "Confidence",
                      value: `${Math.round((issue.avg_confidence || 0.9) * 100)}%`,
                    },
                    {
                      label: "Effort",
                      value: estimateEffort(issue),
                    },
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3 py-2.5"
                    >
                      <p className="text-[10px] text-slate-600 font-semibold mb-1">
                        {cell.label}
                      </p>
                      <p className="text-sm font-bold text-slate-200 font-mono">
                        {cell.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-[#0E1424]/80 border border-white/[0.04] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold mb-1.5">
                    Recommendation
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                    {recommendationFor(issue, rank, dashboard.ai_recommendation)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. Evidence Panel ─────────────────────────────────────────── */}
      <section id="evidence" className="mb-12 scroll-mt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
              Evidence panel
            </p>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Customer voice behind the ranking
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEvidenceOpen((v) => !v)}
          >
            {evidenceOpen ? "Collapse" : "Expand"}
          </Button>
        </div>

        {selected && evidenceOpen && (
          <div className="rounded-[20px] border border-border bg-surface overflow-hidden">
            <div className="px-5 md:px-6 py-5 border-b border-border">
              <p className="text-sm font-bold text-white mb-1">
                {issueTitle(selected.issue_key)}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                Cluster of {selected.review_count} reviews
                {selected.premium_user_count > 0
                  ? ` · ${selected.premium_user_count} premium customers affected`
                  : ""}
                {" · "}
                {selected.category} in {selected.business_area}
              </p>
              {selected.description && (
                <p className="text-sm text-slate-300 mt-3 leading-relaxed max-w-2xl">
                  {selected.description}
                </p>
              )}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {keywords.map((k) => (
                    <span
                      key={k}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/15 text-primary-soft-2 border border-primary/25"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="divide-y divide-white/[0.05]">
              {(selected.sample_reviews || []).slice(0, 6).map((review, i) => {
                const parts = highlightKeywords(review, keywords);
                return (
                  <div key={i} className="px-5 md:px-6 py-4">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      “
                      {parts.map((p, j) =>
                        p.hit ? (
                          <mark
                            key={j}
                            className="bg-primary/25 text-[#E4DFFF] rounded px-0.5"
                          >
                            {p.text}
                          </mark>
                        ) : (
                          <span key={j}>{p.text}</span>
                        )
                      )}
                      ”
                    </p>
                  </div>
                );
              })}
              {(!selected.sample_reviews || selected.sample_reviews.length === 0) && (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  No sample reviews attached to this cluster.
                </div>
              )}
            </div>

            {sessionId && (
              <div className="px-5 md:px-6 py-4 border-t border-border bg-[#0E1424]/50">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/${sessionId}/evidence/${selected.issue_key}`}>
                    Open full evidence
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 4. Decision Timeline ──────────────────────────────────────── */}
      <section className="mb-12">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            Decision timeline
          </p>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Why this order — and what happens next
          </h3>
        </div>

        <div className="relative pl-6 space-y-0">
          <div
            className="absolute left-[9px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/50 via-white/10 to-transparent"
            aria-hidden
          />

          {[
            {
              title: "Why it ranks first",
              body: topIssue
                ? `${issueTitle(topIssue.issue_key)} leads because revenue at risk (${formatRisk(
                    topIssue.revenue_at_risk
                  )}), severity (${(topIssue.avg_severity || 0).toFixed(1)}/10), and reach (${
                    topIssue.review_count
                  } reviews) compound into the highest business-impact score.`
                : "Insufficient data to explain ranking.",
            },
            {
              title: "Business impact",
              body:
                dashboard.ai_recommendation ||
                `Addressing the top cluster protects an estimated ${formatRisk(
                  dashboard.revenue_at_risk
                )} in exposed revenue and reduces premium-customer churn pressure.`,
            },
            {
              title: "Suggested order",
              body: criticalIssues.length
                ? criticalIssues
                    .slice(0, 4)
                    .map((iss, i) => `${i + 1}. ${issueTitle(iss.issue_key)}`)
                    .join(" → ")
                : "No ranked issues available.",
            },
          ].map((step, i) => (
            <div key={step.title} className="relative pb-8 last:pb-0">
              <span className="absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border border-primary/40 bg-background flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B7FF8]" />
              </span>
              <p className="text-[10px] font-mono text-slate-600 mb-1">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h4 className="text-sm font-bold text-white mb-1.5">{step.title}</h4>
              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Roadmap Preview ────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
              Roadmap preview
            </p>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Near-term sequencing
            </h3>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/business/${businessId}/roadmap`}>Full roadmap</Link>
          </Button>
        </div>

        {roadmap.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-white/[0.08] px-6 py-10 text-center text-sm text-slate-500">
            Roadmap not generated for this analysis yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roadmap.slice(0, 3).map((week) => {
              const items = week.tasks || week.issues || [];
              return (
                <div
                  key={week.week}
                  className="rounded-[18px] border border-border bg-surface p-5"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary-soft mb-2">
                    Week {week.week}
                  </p>
                  <p className="text-sm font-bold text-white mb-3 leading-snug">
                    {week.theme}
                  </p>
                  <ul className="space-y-1.5">
                    {items.slice(0, 3).map((item) => (
                      <li
                        key={item}
                        className="text-xs text-slate-400 pl-2 border-l border-white/10 leading-snug"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  {week.effort && (
                    <p className="text-[10px] text-slate-600 mt-3 font-semibold">
                      {week.effort}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 6. Sprint Preview ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
              Sprint preview
            </p>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Ready for engineering
            </h3>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/business/${businessId}/sprint`}>Full sprint</Link>
          </Button>
        </div>

        {stories.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-white/[0.08] px-6 py-10 text-center text-sm text-slate-500">
            Sprint plan not generated for this analysis yet.
          </div>
        ) : (
          <div className="rounded-[20px] border border-border bg-surface divide-y divide-white/[0.05] overflow-hidden">
            {stories.slice(0, 3).map((story, i) => (
              <div key={story.title || i} className="px-5 md:px-6 py-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-bold text-white leading-snug">
                    {story.title || "Untitled story"}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {story.priority && (
                      <Badge variant="outline">{story.priority}</Badge>
                    )}
                    {typeof story.story_points === "number" && (
                      <span className="text-[10px] font-bold font-mono text-slate-500">
                        {story.story_points} pts
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 italic leading-relaxed line-clamp-2">
                  {story.user_story || story.description || "—"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/business/${businessId}/sprint`}>Generate Sprint</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/business/${businessId}/exports`}>Export briefing</Link>
          </Button>
        </div>
      </section>
    </WorkspacePage>
  );
}
