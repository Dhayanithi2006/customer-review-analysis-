"use client";

import { useEffect, useState } from "react";
import type { IssueCluster } from "@/lib/types";
import type { ResolutionImpact } from "@/lib/api";
import { getEvidence } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bandStyles,
  formatRisk,
  issueTitle,
  PILLAR_META,
  priorityBand,
  priorityScore100,
  recommendedAction,
  resolutionStatusLabel,
  estimatedImpact,
} from "./helpers";
import { LifecycleStrip } from "./LifecycleStrip";

interface EvidencePanelProps {
  sessionId: string;
  issue: IssueCluster | null;
  aiRecommendation?: string;
  impact?: ResolutionImpact;
  onPlanAction?: (issue: IssueCluster) => void;
  onSendFollowup?: (issueKey: string, e: React.MouseEvent) => void;
  sendingFollowup?: boolean;
}

interface EvidencePayload {
  affected_customers?: number;
  representative_comments?: Array<{
    text: string;
    source?: string;
    sentiment?: string;
    severity?: number;
  }>;
  sample_reviews?: string[];
  priority_components?: Record<string, unknown>;
  confidence?: number;
  sources?: string[];
}

export function EvidencePanel({
  sessionId,
  issue,
  aiRecommendation,
  impact,
  onPlanAction,
  onSendFollowup,
  sendingFollowup,
}: EvidencePanelProps) {
  const [evidence, setEvidence] = useState<EvidencePayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!issue || !sessionId) {
      setEvidence(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getEvidence(sessionId, issue.issue_key)
      .then((data) => {
        if (!cancelled) setEvidence(data as EvidencePayload);
      })
      .catch(() => {
        if (!cancelled) setEvidence(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, issue?.issue_key]);

  if (!issue) {
    return (
      <section id="evidence" className="mb-10 scroll-mt-20">
        <div className="rounded-[20px] border border-dashed border-white/10 bg-surface/50 p-8 text-center">
          <p className="text-sm text-slate-500">Select an issue to inspect evidence.</p>
        </div>
      </section>
    );
  }

  const rank = issue.priority_rank || 1;
  const band = priorityBand(issue, rank);
  const styles = bandStyles(band);
  const score = priorityScore100(issue.priority_score);
  const pillars = issue.decision_pillars;
  const comments: Array<{
    text: string;
    source?: string;
    sentiment?: string;
    severity?: number;
  }> =
    evidence?.representative_comments?.filter((c) => c.text)?.slice(0, 6) ||
    (issue.sample_reviews || []).slice(0, 6).map((text) => ({ text }));
  const affected = evidence?.affected_customers ?? issue.review_count ?? 0;
  const confidence = evidence?.confidence ?? issue.avg_confidence ?? null;
  const status = resolutionStatusLabel(impact?.status);
  const reopened = impact?.is_reopened || impact?.status === "REOPENED";

  return (
    <section id="evidence" className="mb-10 scroll-mt-20">
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
          Issue evidence
        </p>
        <h3 className="text-lg font-extrabold text-white tracking-tight">
          Why this ranks here
        </h3>
      </div>

      {reopened && (
        <div className="mb-4 rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-bold text-red-200">
            Reopened — needs further attention
          </p>
          <p className="text-xs text-red-200/70 mt-1 leading-relaxed">
            Customer follow-up improvement was below {impact?.threshold ?? 70}%.
            Record a new action to continue the closed loop.
            {impact?.improvement_percentage != null
              ? ` Current improvement: ${impact.improvement_percentage}%.`
              : ""}
          </p>
        </div>
      )}

      <div className={cn(
        "rounded-[20px] border bg-surface overflow-hidden",
        reopened ? "border-red-500/30" : styles.border
      )}>
        <div className="px-5 md:px-6 py-5 border-b border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider border", styles.badge)}>
              {band}
            </span>
            <span className="text-xs text-slate-500">{issue.category}</span>
            <span className="text-xs font-mono text-primary-soft font-bold">
              {score != null ? `${score}/100` : "—"}
            </span>
            <span className={cn(
              "text-xs ml-auto",
              reopened ? "text-red-300 font-semibold" : "text-slate-500"
            )}>
              {status}
            </span>
          </div>
          {impact?.status && (
            <div className="mb-4">
              <LifecycleStrip status={impact.status} compact />
            </div>
          )}
          <h4 className="text-base md:text-lg font-extrabold text-white tracking-tight">
            {issueTitle(issue.issue_key)}
          </h4>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-2xl">
            {recommendedAction(issue, rank, aiRecommendation)}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-0 md:divide-x divide-white/[0.06]">
          {/* Why prioritized */}
          <div className="p-5 md:p-6 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold">
              Why prioritized
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Observed customers affected", value: String(affected) },
                { label: "Est. revenue impact", value: formatRisk(estimatedImpact(issue)) },
                { label: "Severity", value: `${(issue.avg_severity || 0).toFixed(1)} / 5` },
                {
                  label: "Confidence",
                  value:
                    confidence == null
                      ? "—"
                      : `${Math.round(confidence > 1 ? confidence : confidence * 100)}%`,
                },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3 py-2.5">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{m.label}</p>
                  <p className="text-sm font-bold text-white font-mono mt-1">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 pt-1">
              {PILLAR_META.map((p) => {
                const pct = pillars?.[p.pctField] ?? 0;
                const raw = pillars?.[p.field];
                return (
                  <div key={p.key} className="flex items-center gap-2">
                    <span className="w-[7rem] shrink-0 text-[10px] text-slate-500 font-semibold">
                      {p.label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", p.color)}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-[10px] font-mono text-slate-400">
                      {typeof raw === "number" ? Math.round(raw) : "—"} · {p.weight}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {onPlanAction && (
                <Button size="sm" onClick={() => onPlanAction(issue)}>
                  {reopened ? "Take further action" : "Plan / take action"}
                </Button>
              )}
              {onSendFollowup && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sendingFollowup}
                  onClick={(e) => onSendFollowup(issue.issue_key, e)}
                >
                  {sendingFollowup ? "Sending…" : "Send follow-up"}
                </Button>
              )}
            </div>
            {impact && (impact.response_count > 0 || impact.contacted_count > 0) && (
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#0E1424] px-3 py-2.5 text-[11px] text-slate-400 space-y-1">
                <p>
                  Follow-ups contacted: {impact.contacted_count} · Responses:{" "}
                  {impact.response_count}
                </p>
                <p>
                  Improvement: {impact.improvement_percentage}% (threshold{" "}
                  {impact.threshold}%)
                </p>
              </div>
            )}
          </div>

          {/* Customer voice */}
          <div className="p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-3">
              Representative feedback
            </p>
            {loading && (
              <p className="text-xs text-slate-500">Loading evidence…</p>
            )}
            {!loading && comments.length === 0 && (
              <p className="text-xs text-slate-500">No sample comments stored for this cluster.</p>
            )}
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {comments.map((c, i) => (
                <blockquote
                  key={i}
                  className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3.5 py-3"
                >
                  <p className="text-sm text-slate-300 leading-relaxed">
                    “{c.text}”
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-600 font-semibold">
                    {c.source && <span>Source: {c.source}</span>}
                    {c.sentiment && <span>Sentiment: {c.sentiment}</span>}
                    {c.severity != null && <span>Sev: {c.severity}</span>}
                  </div>
                </blockquote>
              ))}
            </div>
            {(evidence?.sources || issue.platforms || []).length > 0 && (
              <p className="text-[10px] text-slate-600 mt-3">
                Sources: {(evidence?.sources || issue.platforms || []).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
