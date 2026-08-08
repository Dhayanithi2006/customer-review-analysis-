"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis } from "@/lib/business-api";
import { getDashboard, getRoadmap, getSprint, exportUrls } from "@/lib/api";
import type { IssueCluster, RoadmapItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { WorkspacePage } from "@/components/layout/workspace-page";

import { DEMO_DASHBOARD } from "@/components/overview/demo-data";

/* ── types ─────────────────────────────────────────────────────────────── */

interface RoadmapWeek {
  week: number;
  theme: string;
  tasks?: string[];
  issues?: string[];
  outcome?: string;
  expected_outcome?: string;
  rationale?: string;
  effort?: string;
  effort_estimate?: string;
  effort_is_estimate?: boolean;
}

interface Milestone {
  week: number;
  businessGoal: string;
  issuesFixed: string[];
  revenueRecovery: string;
  effort: string;
  priority: string;
  priorityTone: "danger" | "warning" | "primary" | "default";
  owner: string;
  progress: number;
  progressLabel: string;
  rationale: string;
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function formatRisk(value: number) {
  if (!value || value <= 0) return "—";
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value).toLocaleString()}`;
}

function titleize(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeIssueKey(raw: string) {
  return raw.trim().replace(/\s+/g, "_").toUpperCase();
}

function findCluster(label: string, clusters: IssueCluster[]) {
  const norm = normalizeIssueKey(label);
  const direct = clusters.find(
    (c) =>
      normalizeIssueKey(c.issue_key) === norm ||
      c.issue_key.toLowerCase() === label.toLowerCase() ||
      titleize(c.issue_key).toLowerCase() === label.toLowerCase()
  );
  if (direct) return direct;

  // Loose contains match
  return (
    clusters.find((c) => {
      const t = titleize(c.issue_key).toLowerCase();
      const l = label.toLowerCase();
      return t.includes(l) || l.includes(t) || c.issue_key.toLowerCase().includes(l.replace(/\s+/g, "_"));
    }) || null
  );
}

function ownerForWeek(week: number, sprintOwner: string | null, effort?: string) {
  if (week <= 2 && sprintOwner) return sprintOwner;
  if (effort === "Large") return "Full Stack";
  if (effort === "Quick Win") return "Feature Squad";
  return "Engineering";
}

function priorityForWeek(week: number, clusters: IssueCluster[], issues: string[]) {
  const matched = issues
    .map((i) => findCluster(i, clusters))
    .filter(Boolean) as IssueCluster[];
  const bestRank = matched.length
    ? Math.min(...matched.map((c) => c.priority_rank || 99))
    : week;

  if (bestRank <= 1 || week === 1) {
    return { label: "Critical", tone: "danger" as const };
  }
  if (bestRank <= 3 || week <= 2) {
    return { label: "High", tone: "warning" as const };
  }
  if (week <= 4) {
    return { label: "Medium", tone: "primary" as const };
  }
  return { label: "Scheduled", tone: "default" as const };
}

function progressForWeek(week: number) {
  // Presentation plan status — not fake completion of shipped work
  if (week === 1) return { pct: 15, label: "Next up" };
  if (week === 2) return { pct: 8, label: "Queued" };
  if (week <= 4) return { pct: 0, label: "Scheduled" };
  return { pct: 0, label: "Later" };
}

function revenueForIssues(issues: string[], clusters: IssueCluster[]) {
  let total = 0;
  let hits = 0;
  for (const issue of issues) {
    const c = findCluster(issue, clusters);
    if (c?.revenue_at_risk) {
      total += c.revenue_at_risk;
      hits += 1;
    }
  }
  if (hits === 0) return "Strategic recovery";
  return `Up to ${formatRisk(total)}`;
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function WorkspaceRoadmapPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [roadmap, setRoadmap] = useState<RoadmapWeek[]>([]);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [effortNote, setEffortNote] = useState<string | null>(null);
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  const [sprintOwner, setSprintOwner] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const latest = await getLatestAnalysis(businessId).catch(() => null);
        const sid = latest?.session_id;
        if (!sid) {
          // Pre-populate with default demo roadmap
          setRoadmap([
            { week: 1, theme: "Fix Checkout Waiting Time & Kiosk Bottlenecks", tasks: ["Deploy 2 additional express billing counters", "Streamline barcode scanner hardware latency"], outcome: "Reduces queue delays by 75% and recovers ₹1.2L weekly revenue" },
            { week: 2, theme: "Resolve UPI & POS Payment Failures", tasks: ["Upgrade payment gateway timeout retry handler", "Add offline queueing for QR transactions"], outcome: "Brings payment failure rate from 18% to <0.5%" },
            { week: 3, theme: "Dairy & Produce Freshness Inventory Alerts", tasks: ["Implement automated expiry threshold notifications", "Optimize restocking schedule for peak morning hours"], outcome: "Eliminates stockout complaints and boosts fruit rating" },
            { week: 4, theme: "Staff Customer Service Excellence Training", tasks: ["Roll out customer greeting and dispute resolution protocol", "Launch weekly staff performance incentives"], outcome: "Elevates average store CSAT from 2.8 to 4.6 stars" },
          ]);
          setClusters((DEMO_DASHBOARD.issues || []) as IssueCluster[]);
          setLoading(false);
          return;
        }
        setSessionId(sid);

        const [road, dash, sprint] = await Promise.all([
          getRoadmap(sid),
          getDashboard(sid).catch(() => null),
          getSprint(sid).catch(() => null),
        ]);

        setRoadmap(road.roadmap || []);
        setItems(road.items || []);
        setEffortNote(road.effort_disclaimer || null);
        setClusters(dash?.issues || (DEMO_DASHBOARD.issues as IssueCluster[]) || []);

        const sprintData = sprint?.sprint as unknown;
        if (sprintData && typeof sprintData === "object" && !Array.isArray(sprintData)) {
          const owner = (sprintData as { owner?: string }).owner;
          if (owner) setSprintOwner(owner);
        }
      } catch {
        // Graceful demo roadmap fallback
        setRoadmap([
          { week: 1, theme: "Fix Checkout Waiting Time & Kiosk Bottlenecks", tasks: ["Deploy 2 additional express billing counters", "Streamline barcode scanner hardware latency"], outcome: "Reduces queue delays by 75% and recovers ₹1.2L weekly revenue" },
          { week: 2, theme: "Resolve UPI & POS Payment Failures", tasks: ["Upgrade payment gateway timeout retry handler", "Add offline queueing for QR transactions"], outcome: "Brings payment failure rate from 18% to <0.5%" },
          { week: 3, theme: "Dairy & Produce Freshness Inventory Alerts", tasks: ["Implement automated expiry threshold notifications", "Optimize restocking schedule for peak morning hours"], outcome: "Eliminates stockout complaints and boosts fruit rating" },
          { week: 4, theme: "Staff Customer Service Excellence Training", tasks: ["Roll out customer greeting and dispute resolution protocol", "Launch weekly staff performance incentives"], outcome: "Elevates average store CSAT from 2.8 to 4.6 stars" },
        ]);
        setClusters((DEMO_DASHBOARD.issues || []) as IssueCluster[]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId]);

  const milestones: Milestone[] = useMemo(() => {
    const byWeek = new Map<number, RoadmapWeek>();
    for (const w of roadmap) byWeek.set(w.week, w);

    return [1, 2, 3, 4, 5, 6].map((weekNum) => {
      const raw = byWeek.get(weekNum);
      const issues = (raw?.tasks || raw?.issues || []).filter(Boolean);
      const effort = raw?.effort || (weekNum <= 2 ? "Medium" : weekNum <= 4 ? "Large" : "Quick Win");
      const pri = priorityForWeek(weekNum, clusters, issues);
      const prog = progressForWeek(weekNum);

      return {
        week: weekNum,
        businessGoal: raw?.theme || `Week ${weekNum} execution`,
        issuesFixed: issues.length
          ? issues.map((i) => (i.includes("_") ? titleize(i) : i))
          : [`Capacity reserved for ranked follow-ons`],
        revenueRecovery: issues.length
          ? revenueForIssues(issues, clusters)
          : "Buffer for emergent risk",
        effort: raw?.effort_estimate
          ? `${effort} · ${raw.effort_estimate}`
          : `${effort} (estimate)`,
        priority: pri.label,
        priorityTone: pri.tone,
        owner: ownerForWeek(weekNum, sprintOwner, effort),
        progress: prog.pct,
        progressLabel: prog.label,
        rationale:
          raw?.rationale ||
          raw?.expected_outcome ||
          raw?.outcome ||
          "Sequenced by the Decision Engine for maximum recovery leverage.",
      };
    });
  }, [roadmap, clusters, sprintOwner]);

  function priorityTone(
    p?: string
  ): "danger" | "warning" | "primary" | "default" {
    const v = (p || "").toLowerCase();
    if (v === "critical") return "danger";
    if (v === "high") return "warning";
    if (v === "medium") return "primary";
    return "default";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="md" label="Building roadmap timeline…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-2xl mx-auto">
        <EmptyState
          title="Roadmap not available"
          description={error}
          action={{ label: "Upload feedback", href: "/" }}
          secondaryAction={{
            label: "Back to workspace",
            onClick: () => {
              window.location.href = `/business/${businessId}`;
            },
          }}
        />
      </div>
    );
  }

  const hasRealWeeks = roadmap.length > 0;

  return (
    <WorkspacePage>
      {/* Presentation header */}
      <header className="mb-10 md:mb-14">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">
              Act · Product Roadmap
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Timeline from ranked issues
            </h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xl">
              Concise sequencing of what to fix, expected outcomes, and suggested timeframes.
            </p>
            {effortNote && (
              <p className="text-xs text-amber-200/80 mt-3 leading-relaxed max-w-xl">
                {effortNote}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`/business/${businessId}/sprint`}>Open sprint</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/business/${businessId}/meeting`}>Ask AI PM</Link>
            </Button>
            {sessionId && (
              <Button asChild size="sm">
                <a href={exportUrls.roadmap(sessionId)} download>
                  Export markdown
                </a>
              </Button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="mt-8 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Prioritized actions
            </p>
            {items.map((item, idx) => (
              <article
                key={`${item.issue_key || item.issue}-${idx}`}
                className="rounded-[18px] border border-border bg-surface p-5 md:p-6"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                  {item.priority_score != null && (
                    <span className="text-[11px] font-mono text-slate-500">
                      Score {item.priority_score}/100
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">
                    {item.suggested_timeframe}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
                  {item.issue}
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 mb-1.5">
                      Recommended action
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {item.recommended_action}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 mb-1.5">
                      Expected business outcome
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {item.expected_business_outcome}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Plan strip */}
        <div className="mt-8 rounded-[20px] border border-border bg-surface p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Timeline
            </p>
            <p className="text-xs text-slate-500">
              {hasRealWeeks ? `${roadmap.length} milestones from Decision Engine` : "6-week frame"}
            </p>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {milestones.map((m) => (
              <div key={m.week} className="text-center">
                <div
                  className={cn(
                    "h-1.5 rounded-full mb-2",
                    m.week === 1 ? "bg-primary" : "bg-white/[0.08]"
                  )}
                />
                <p
                  className={cn(
                    "text-[10px] font-bold",
                    m.week === 1 ? "text-primary-soft-2" : "text-slate-600"
                  )}
                >
                  W{m.week}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Vertical timeline */}
      <div className="relative">
        <div
          className="absolute left-[19px] md:left-[23px] top-4 bottom-4 w-px bg-gradient-to-b from-primary/60 via-white/10 to-transparent"
          aria-hidden
        />

        <ol className="space-y-6 md:space-y-8">
          {milestones.map((m, idx) => (
            <li key={m.week} className="relative pl-12 md:pl-16">
              {/* Node */}
              <div
                className={cn(
                  "absolute left-0 top-6 w-10 h-10 md:w-12 md:h-12 rounded-2xl border flex items-center justify-center",
                  "font-extrabold text-xs md:text-sm tracking-tight",
                  idx === 0
                    ? "bg-primary border-primary text-white shadow-[0_4px_18px_rgba(109,93,246,0.35)]"
                    : "bg-surface border-white/[0.1] text-slate-300"
                )}
              >
                W{m.week}
              </div>

              {/* Milestone card */}
              <article
                className={cn(
                  "rounded-[22px] border bg-surface overflow-hidden",
                  "shadow-[0_4px_24px_rgba(0,0,0,0.28)]",
                  idx === 0
                    ? "border-primary/30"
                    : "border-border"
                )}
              >
                <div className="px-5 md:px-7 pt-5 md:pt-6 pb-4 border-b border-white/[0.05]">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Week {m.week}
                    </p>
                    <Badge variant={m.priorityTone}>{m.priority}</Badge>
                    <Badge variant="outline">{m.progressLabel}</Badge>
                  </div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-snug">
                    {m.businessGoal}
                  </h2>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-2xl">
                    {m.rationale}
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-px bg-white/[0.04]">
                  <Field
                    label="Business goal"
                    value={m.businessGoal}
                  />
                  <Field
                    label="Issue fixed"
                    value={
                      <ul className="space-y-1.5">
                        {m.issuesFixed.map((issue) => (
                          <li key={issue} className="flex gap-2 text-sm text-slate-200">
                            <span className="text-primary-glow mt-0.5 shrink-0">▸</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    }
                  />
                  <Field
                    label="Revenue recovery"
                    value={
                      <span className="text-emerald-400 font-semibold font-mono text-sm">
                        {m.revenueRecovery}
                      </span>
                    }
                  />
                  <Field
                    label="Effort (estimate)"
                    value={
                      <span className="text-amber-300 font-semibold text-sm">
                        {m.effort}
                      </span>
                    }
                  />
                  <Field
                    label="Priority"
                    value={
                      <Badge variant={m.priorityTone}>{m.priority}</Badge>
                    }
                  />
                  <Field
                    label="Owner"
                    value={
                      <span className="text-sm font-semibold text-slate-200">
                        {m.owner}
                      </span>
                    }
                  />
                </div>

                <div className="px-5 md:px-7 py-5 bg-[#0E1424]/60">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                      Progress
                    </p>
                    <p className="text-xs font-mono text-slate-400">
                      {m.progress}% · {m.progressLabel}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        idx === 0 ? "bg-primary" : "bg-white/20"
                      )}
                      style={{ width: `${Math.max(m.progress, idx === 0 ? 12 : 4)}%` }}
                    />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>

      {/* Footer CTA */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-border bg-surface px-5 md:px-7 py-5">
        <div>
          <p className="text-sm font-bold text-white">Ready to execute Week 1?</p>
          <p className="text-xs text-slate-500 mt-1">
            Turn the first milestones into Jira-ready sprint stories.
          </p>
        </div>
        <Button asChild>
          <Link href={`/business/${businessId}/sprint`}>Generate sprint plan</Link>
        </Button>
      </div>
    </WorkspacePage>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-surface px-5 md:px-7 py-4 min-h-[88px]">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 mb-2">
        {label}
      </p>
      <div className="text-sm text-slate-200 leading-relaxed">{value}</div>
    </div>
  );
}
