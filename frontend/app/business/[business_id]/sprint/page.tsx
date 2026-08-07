"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { getLatestAnalysis } from "@/lib/business-api";
import { getDashboard, getSprint, exportUrls } from "@/lib/api";
import type { IssueCluster } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { WorkspacePage } from "@/components/layout/workspace-page";

/* ── types ─────────────────────────────────────────────────────────────── */

interface Story {
  id?: string;
  title?: string;
  user_story?: string;
  description?: string;
  acceptance_criteria?: string[];
  story_points?: number;
  priority?: string;
  linked_issue?: string;
  issue_key?: string;
  effort?: string;
}

interface SprintMeta {
  name: string;
  owner: string;
  duration_weeks: number;
  total_story_points: number | null;
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function formatRisk(value: number) {
  if (!value || value <= 0) return null;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value).toLocaleString()}`;
}

function titleize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimateDays(story: Story): string {
  const effort = (story.effort || "").toUpperCase();
  if (effort === "S") return "~1–2 days";
  if (effort === "M") return "~3–5 days";
  if (effort === "L") return "~1–2 weeks";
  const pts = story.story_points || 0;
  if (pts <= 2) return "~1–2 days";
  if (pts <= 5) return "~3–5 days";
  if (pts <= 8) return "~1 week";
  return "~1–2 weeks";
}

function priorityVariant(
  p?: string
): "danger" | "warning" | "primary" | "default" {
  const v = (p || "").toLowerCase();
  if (v === "critical" || v === "high") return v === "critical" ? "danger" : "warning";
  if (v === "medium") return "primary";
  return "default";
}

function findCluster(key: string | undefined, clusters: IssueCluster[]) {
  if (!key) return null;
  const norm = key.trim().toLowerCase().replace(/\s+/g, "_");
  return (
    clusters.find(
      (c) =>
        c.issue_key.toLowerCase() === norm ||
        c.issue_key.toLowerCase().replace(/_/g, " ") === key.toLowerCase()
    ) || null
  );
}

function businessValueFor(story: Story, clusters: IssueCluster[]) {
  const key = story.linked_issue || story.issue_key;
  const cluster = findCluster(key, clusters);
  if (cluster?.revenue_at_risk) {
    const risk = formatRisk(cluster.revenue_at_risk);
    return risk ? `Protects ${risk} revenue at risk` : cluster.description;
  }
  if (cluster?.description) return cluster.description;
  if (story.priority && ["High", "Critical", "high", "critical"].includes(story.priority)) {
    return "High-leverage fix for revenue-critical customer pain";
  }
  return "Improves customer experience from ranked feedback";
}

/* ── expandable story row (Linear-like) ────────────────────────────────── */

function StoryRow({
  story,
  index,
  clusters,
}: {
  story: Story;
  index: number;
  clusters: IssueCluster[];
}) {
  const [open, setOpen] = useState(index === 0);
  const id = story.id || `S1-${String(index + 1).padStart(3, "0")}`;
  const body = story.user_story || story.description || "";
  const issueRef = story.linked_issue || story.issue_key;
  const value = businessValueFor(story, clusters);

  return (
    <div
      className={cn(
        "border-b border-white/[0.05] last:border-0 transition-colors",
        open ? "bg-[#0E1424]/50" : "hover:bg-white/[0.015]"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 md:px-6 py-4 flex items-start gap-3"
      >
        <span className="mt-1 text-slate-600 shrink-0">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-mono text-[11px] text-slate-600">{id}</span>
            <Badge variant={priorityVariant(story.priority)}>
              {story.priority || "Medium"}
            </Badge>
            <span className="text-[11px] font-mono font-semibold text-primary-soft tabular-nums">
              {story.story_points ?? 0} pts
            </span>
            <span className="text-[11px] text-slate-500">{estimateDays(story)}</span>
          </div>
          <p className="text-[15px] font-semibold text-white tracking-tight leading-snug">
            {story.title || "Untitled story"}
          </p>
          {!open && body && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-1 leading-relaxed">
              {body}
            </p>
          )}
        </div>
      </button>

      {open && (
        <div className="px-5 md:px-6 pb-5 pl-11 md:pl-12 space-y-4 animate-fade-in">
          {body && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 mb-1.5">
                User story
              </p>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                {body}
              </p>
            </div>
          )}

          {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 mb-2">
                Acceptance criteria
              </p>
              <ul className="space-y-2">
                {story.acceptance_criteria.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed"
                  >
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <MetaCell label="Business value" value={value} />
            <MetaCell
              label="Linked issue"
              value={issueRef ? titleize(issueRef) : "—"}
              mono={Boolean(issueRef)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-surface px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-sm text-slate-200 leading-relaxed",
          mono && "font-mono text-xs text-primary-soft"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function WorkspaceSprintPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [stories, setStories] = useState<Story[]>([]);
  const [meta, setMeta] = useState<SprintMeta>({
    name: "Sprint 1",
    owner: "Engineering",
    duration_weeks: 2,
    total_story_points: null,
  });
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const latest = await getLatestAnalysis(businessId);
        if (!latest.has_analysis || !latest.session_id) {
          setError(
            "No analysis available. Run an analysis first to generate a sprint plan."
          );
          return;
        }
        const sid = latest.session_id;
        setSessionId(sid);

        const [data, dash] = await Promise.all([
          getSprint(sid),
          getDashboard(sid).catch(() => null),
        ]);

        setClusters(dash?.issues || []);

        const sprintData = data.sprint as unknown;
        let storyList: Story[] = [];
        let nextMeta: SprintMeta = {
          name: "Sprint 1",
          owner: "Engineering",
          duration_weeks: 2,
          total_story_points: null,
        };

        if (Array.isArray(sprintData)) {
          storyList = sprintData as Story[];
        } else if (sprintData && typeof sprintData === "object") {
          const s = sprintData as {
            name?: string;
            owner?: string;
            duration_weeks?: number;
            total_story_points?: number;
            stories?: Story[];
          };
          storyList = s.stories || [];
          nextMeta = {
            name: s.name || "Sprint 1",
            owner: s.owner || "Engineering",
            duration_weeks: s.duration_weeks || 2,
            total_story_points: s.total_story_points ?? null,
          };
        }

        setStories(storyList);
        setMeta(nextMeta);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load sprint plan");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId]);

  const totals = useMemo(() => {
    const points =
      meta.total_story_points ??
      stories.reduce((sum, s) => sum + (s.story_points || 0), 0);
    const high = stories.filter((s) =>
      ["high", "critical"].includes((s.priority || "").toLowerCase())
    ).length;

    const topValue = stories
      .map((s) => {
        const c = findCluster(s.linked_issue || s.issue_key, clusters);
        return c?.revenue_at_risk || 0;
      })
      .reduce((a, b) => a + b, 0);

    return { points, high, topValue };
  }, [stories, meta.total_story_points, clusters]);

  const sprintPriority =
    totals.high >= Math.max(1, Math.ceil(stories.length / 2))
      ? "High"
      : stories.some((s) => (s.priority || "").toLowerCase() === "critical")
      ? "Critical"
      : "Medium";

  const estimatedTime =
    meta.duration_weeks === 1
      ? "~1 week"
      : `~${meta.duration_weeks || 2} weeks`;

  const sprintBusinessValue =
    totals.topValue > 0
      ? `Protects up to ${formatRisk(totals.topValue)} in exposed revenue`
      : "Ships the highest-leverage fixes from the Decision Center";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="md" label="Loading sprint plan…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-2xl mx-auto">
        <EmptyState
          title="Sprint plan not available"
          description={error}
          action={{ label: "Upload feedback", href: "/" }}
          secondaryAction={{
            label: "Open roadmap",
            onClick: () => {
              window.location.href = `/business/${businessId}/roadmap`;
            },
          }}
        />
      </div>
    );
  }

  return (
    <WorkspacePage>
      {/* Header */}
      <header className="mb-8 md:mb-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Sprint Planning
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Engineering-ready work
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-xl leading-relaxed">
          Linear-style sprint cards generated from ranked customer issues — export straight to Jira.
        </p>
      </header>

      {/* Sprint Card */}
      <article
        className={cn(
          "rounded-[20px] border border-white/[0.08] bg-surface overflow-hidden",
          "shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
        )}
      >
        {/* Sprint header */}
        <div className="px-5 md:px-7 py-5 md:py-6 border-b border-border">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-left flex items-start gap-3 min-w-0 flex-1"
            >
              <span className="mt-1.5 text-slate-500 shrink-0">
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-2">
                  <Badge variant="primary">Active</Badge>
                  <Badge variant={priorityVariant(sprintPriority)}>
                    {sprintPriority}
                  </Badge>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white leading-tight">
                  {meta.name}
                </h2>
                <p className="text-sm text-slate-400 mt-1.5">
                  {stories.length} user{" "}
                  {stories.length === 1 ? "story" : "stories"} · {totals.points}{" "}
                  story points · {meta.owner}
                </p>
              </div>
            </button>

            {sessionId && (
              <Button asChild size="sm" className="shrink-0 self-start">
                <a href={exportUrls.sprint(sessionId)} download>
                  <Download size={14} />
                  Export Jira
                </a>
              </Button>
            )}
          </div>

          {/* Sprint meta grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
            {[
              {
                label: "User stories",
                value: String(stories.length),
              },
              {
                label: "Story points",
                value: String(totals.points),
              },
              {
                label: "Priority",
                value: sprintPriority,
              },
              {
                label: "Estimated time",
                value: estimatedTime,
              },
              {
                label: "Engineering owner",
                value: meta.owner,
              },
              {
                label: "Business value",
                value: sprintBusinessValue,
              },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-2xl border border-white/[0.05] bg-[#0E1424] px-4 py-3.5"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 mb-1.5">
                  {cell.label}
                </p>
                <p className="text-sm font-semibold text-slate-100 leading-snug">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expandable stories */}
        {expanded && (
          <div>
            <div className="px-5 md:px-7 py-3 border-b border-white/[0.05] bg-[#0E1424]/40 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Stories
              </p>
              <p className="text-[11px] text-slate-600">
                Click a row to expand
              </p>
            </div>

            {stories.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No stories in this sprint yet.
              </div>
            ) : (
              stories.map((story, i) => (
                <StoryRow
                  key={`${story.id || story.title}-${i}`}
                  story={story}
                  index={i}
                  clusters={clusters}
                />
              ))
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="px-5 md:px-7 py-4 border-t border-border flex flex-wrap items-center gap-3 bg-[#0E1424]/30">
          {sessionId && (
            <Button asChild size="sm">
              <a href={exportUrls.sprint(sessionId)} download>
                <Download size={14} />
                Export Jira CSV
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/business/${businessId}/roadmap`}>View roadmap</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/business/${businessId}/analysis`}>Decision Center</Link>
          </Button>
        </div>
      </article>
    </WorkspacePage>
  );
}
