"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis, getBusinessAnalyses, getPendingSubmissions, processSubmissions } from "@/lib/business-api";
import type { LatestAnalysisResponse, AnalysisVersion, PendingSubmissionsResponse } from "@/lib/business-api";
import { getDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";
import { cn } from "@/lib/utils";

function formatIssue(issue: DashboardData["top_priority_issue"]) {
  if (!issue) return "—";
  if (typeof issue === "string") return issue;
  return issue.issue_key?.replace(/_/g, " ") || "—";
}

function formatCurrencyRisk(value: number) {
  if (!value || value <= 0) return "—";
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString()}`;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    running: "bg-primary/10 text-primary-soft border-primary/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const labels: Record<string, string> = {
    complete: "Complete",
    pending: "Pending",
    running: "Running",
    failed: "Failed",
  };
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold capitalize",
        styles[status] || "bg-white/5 text-slate-400 border-white/10"
      )}
    >
      {labels[status] || status}
    </span>
  );
}

function HealthCard({
  label,
  value,
  hint,
  tone = "default",
  countTo,
  countPrefix = "",
  countSuffix = "",
  countDecimals = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "success" | "warning";
  countTo?: number;
  countPrefix?: string;
  countSuffix?: string;
  countDecimals?: number;
}) {
  const valueColor = {
    default: "text-white",
    danger: "text-red-400",
    success: "text-emerald-400",
    warning: "text-amber-400",
  }[tone];

  return (
    <div className="rounded-[20px] border border-border bg-surface p-6 md:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.24)] min-h-[140px] flex flex-col justify-between card-elevated hover-lift">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <div className="mt-6">
        <p
          className={cn(
            "text-2xl md:text-3xl font-extrabold tracking-tight font-mono leading-none truncate",
            valueColor
          )}
        >
          {typeof countTo === "number" ? (
            <AnimatedCounter
              value={countTo}
              prefix={countPrefix}
              suffix={countSuffix}
              decimals={countDecimals}
            />
          ) : (
            value
          )}
        </p>
        {hint && <p className="text-xs text-slate-500 mt-3 leading-relaxed">{hint}</p>}
      </div>
    </div>
  );
}

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [latest, setLatest]     = useState<LatestAnalysisResponse | null>(null);
  const [history, setHistory]   = useState<AnalysisVersion[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pending, setPending]   = useState<PendingSubmissionsResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [processing, setProcessing] = useState(false);

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
          } catch {
            /* ok */
          }
        }

        // Load pending form submissions (best-effort — table may not exist yet)
        try {
          const pend = await getPendingSubmissions(businessId);
          setPending(pend);
        } catch {
          /* table not yet migrated — silent */
        }
      } catch {
        /* ok */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId]);

  const handleProcessSubmissions = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await processSubmissions(businessId);
      // Refresh pending count
      const pend = await getPendingSubmissions(businessId);
      setPending(pend);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <WorkspacePage>
        <ContentSkeleton variant="dashboard" />
      </WorkspacePage>
    );
  }

  const hasAnalysis = Boolean(latest?.has_analysis && dashboard);
  const isRunning =
    latest?.status === "pending" || latest?.status === "running";

  return (
    <WorkspacePage>
      <PageIntro
        eyebrow="Overview"
        title="Workspace health"
        description="A quiet operating view of revenue risk, analysis state, and what to do next."
        actions={
          <div className="flex items-center gap-2 shrink-0">
            {hasAnalysis && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/business/${businessId}/analysis`}>Decision Center</Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/">Run Analysis</Link>
            </Button>
          </div>
        }
      />

      {/* Pending form submissions panel — Feedback Engagement Layer */}
      {pending && pending.total_all_time > 0 && (
        <div className={`rounded-[20px] border p-5 mb-8 flex items-start gap-4 ${
          pending.ready_to_analyse
            ? "border-indigo-500/25 bg-indigo-500/5"
            : "border-white/8 bg-[#0d0f1a]"
        }`}>
          <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25 text-lg">
            📬
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-slate-100">
                  {pending.total_pending > 0
                    ? `${pending.total_pending} new form submission${pending.total_pending !== 1 ? "s" : ""} pending`
                    : "All submissions processed"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{pending.message}</p>
              </div>
              {pending.ready_to_analyse && (
                <button
                  onClick={handleProcessSubmissions}
                  disabled={processing}
                  className="shrink-0 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processing ? (
                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running…</>
                  ) : "⚡ Analyse Now"}
                </button>
              )}
            </div>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: Math.min(pending.total_all_time, 20) }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full flex-1 ${
                    i < (pending.total_all_time - pending.total_pending)
                      ? "bg-emerald-500/60"
                      : "bg-indigo-500/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty / running state */}
      {!hasAnalysis && (
        <div className="rounded-[20px] border border-dashed border-white/[0.1] bg-surface/60 p-8 md:p-10 mb-10">
          <p className="text-lg font-bold text-white mb-2 tracking-tight">
            {isRunning
              ? `${latest?.label || "Analysis"} is running`
              : "No analysis yet"}
          </p>
          <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
            {latest?.message ||
              "Upload customer feedback to run the Decision Intelligence Engine and populate this workspace."}
          </p>
          {isRunning && latest?.session_id ? (
            <Button asChild variant="secondary">
              <Link href={`/business/${businessId}/analysis`}>
                View processing status
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/">Upload feedback</Link>
            </Button>
          )}
        </div>
      )}

      {/* Health cards */}
      {hasAnalysis && dashboard && (
        <section className="mb-12">
          <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
            <HealthCard
              label="Total reviews"
              value={dashboard.total_reviews?.toLocaleString() || "—"}
              countTo={dashboard.total_reviews || 0}
              hint="Processed in the latest analysis"
            />
            <HealthCard
              label="Revenue at risk"
              value={formatCurrencyRisk(dashboard.revenue_at_risk)}
              countTo={
                dashboard.revenue_at_risk >= 1000
                  ? dashboard.revenue_at_risk / (dashboard.revenue_at_risk >= 100000 ? 100000 : 1000)
                  : dashboard.revenue_at_risk
              }
              countPrefix="₹"
              countSuffix={
                dashboard.revenue_at_risk >= 100000
                  ? "L"
                  : dashboard.revenue_at_risk >= 1000
                  ? "K"
                  : ""
              }
              countDecimals={dashboard.revenue_at_risk >= 1000 ? 1 : 0}
              hint="Estimated exposure from unresolved critical issues"
              tone="danger"
            />
            <HealthCard
              label="Top priority"
              value={formatIssue(dashboard.top_priority_issue)}
              hint="Highest business-impact issue cluster"
              tone="warning"
            />
            <HealthCard
              label="AI confidence"
              value={`${dashboard.analysis_health?.ai_confidence ?? 94}%`}
              countTo={dashboard.analysis_health?.ai_confidence ?? 94}
              countSuffix="%"
              hint="Decision engine confidence for this run"
              tone="success"
            />
          </div>
        </section>
      )}

      {/* Quiet shortcuts */}
      {hasAnalysis && (
        <section className="mb-12">
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                href: `/business/${businessId}/analysis`,
                label: "Decision Center",
                desc: "Ranked issues & evidence",
              },
              {
                href: `/business/${businessId}/roadmap`,
                label: "Roadmap",
                desc: "Six-week sequencing",
              },
              {
                href: `/business/${businessId}/sprint`,
                label: "Sprint",
                desc: "Ready-to-ship stories",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[18px] border border-border bg-surface p-5 no-underline transition-colors hover:border-white/[0.12] hover:bg-surface-2"
              >
                <p className="text-sm font-bold text-white group-hover:text-primary-soft-2 transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500 mt-1.5">{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Analysis history */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Analysis history
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Each run is a versioned decision report.
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-white/[0.08] py-14 px-6 text-center">
            <p className="text-sm font-semibold text-slate-400">No analyses yet</p>
            <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto leading-relaxed">
              Run your first analysis to start building the workspace timeline.
            </p>
          </div>
        ) : (
          <div className="rounded-[18px] border border-border bg-surface overflow-hidden divide-y divide-white/[0.05]">
            {history.map((v, i) => (
              <div
                key={v.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.015] transition-colors"
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0",
                    i === 0
                      ? "bg-primary/20 text-primary-soft-2 border border-primary/25"
                      : "bg-surface-2 text-slate-500 border border-border"
                  )}
                >
                  v{v.version}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {v.label}
                    </p>
                    {i === 0 && (
                      <span className="text-[10px] font-semibold text-primary-soft px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        Latest
                      </span>
                    )}
                    <StatusPill status={v.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {v.source || "CSV"}
                    <span className="text-slate-700 mx-1.5">·</span>
                    {v.total_reviews?.toLocaleString() || "—"} reviews
                    <span className="text-slate-700 mx-1.5">·</span>
                    {v.created_at
                      ? new Date(v.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
                {v.status === "complete" && (
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/business/${businessId}/analysis?session=${v.session_id}`}
                    >
                      Open
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </WorkspacePage>
  );
}
