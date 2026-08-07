"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, FileText, Star, CircleDollarSign } from "lucide-react";
import { getEvidence } from "@/lib/api";
import type { EvidenceData } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageLoader } from "@/components/shared/PageLoader";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

const SEVERITY_COLOR = (s: number) =>
  s >= 8 ? "#EF4444" : s >= 5 ? "#F59E0B" : "#22C55E";

function SeverityBar({ value }: { value: number }) {
  const pct = (value / 10) * 100;
  const color = SEVERITY_COLOR(value);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
        <span>Severity</span>
        <span className="font-mono font-bold" style={{ color }}>{value.toFixed(1)}/10</span>
      </div>
      <div className="h-2 rounded-full bg-[#1e2235] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}50` }}
        />
      </div>
    </div>
  );
}

export default function EvidencePage() {
  const params    = useParams();
  const sessionId = params.session_id as string;
  const issueKey  = params.issue_key as string;

  const [data, setData]       = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeReview, setActiveReview] = useState(0);

  useEffect(() => {
    getEvidence(sessionId, issueKey)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId, issueKey]);

  if (loading) return <PageLoader label="Loading evidence…" />;
  if (error)   return <ErrorState message={error} />;
  if (!data)   return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title="Evidence Panel"
        sessionId={sessionId}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/roadmap`} id="btn-view-in-roadmap">Roadmap</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/meeting`} id="btn-ask-about-issue">Ask AI</Link>
            </Button>
          </div>
        }
      />

      <WorkspacePage width="narrow">
        <PageIntro
          eyebrow="Evidence"
          title={issueKey.replace(/_/g, " ")}
          description={data.description}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={data.category} />
              <span className="text-xs px-2 py-0.5 rounded-full border border-border text-slate-400 bg-surface-2">
                {data.business_area}
              </span>
            </div>
          }
        />

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 animate-fade-in" style={{ animationDelay: "0.08s" }}>
          <MetricCard
            label="Confidence"
            value={`${data.confidence}%`}
            accentColor={data.confidence >= 80 ? "#22C55E" : "#F59E0B"}
            icon={data.confidence >= 80 ? <CheckCircle2 className="text-emerald-400" /> : <AlertTriangle className="text-amber-400" />}
          />
          <MetricCard
            label="Evidence"
            value={`${data.review_count} reviews`}
            icon={<FileText />}
          />
          <MetricCard
            label="Premium users"
            value={`${data.premium_user_count} affected`}
            accentColor="#A99FFF"
            icon={<Star />}
          />
          <div className="rounded-[18px] border border-border bg-surface p-5 col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Avg severity</p>
            <p className="text-2xl font-extrabold" style={{ color: SEVERITY_COLOR(data.avg_severity || 5) }}>
              {(data.avg_severity || 0).toFixed(1)}<span className="text-base text-slate-500">/10</span>
            </p>
            <SeverityBar value={data.avg_severity || 5} />
          </div>
          <MetricCard
            label="Revenue at risk"
            value={`₹${((data.revenue_at_risk || 0) / 1000).toFixed(1)}K`}
            accentColor="#EF4444"
            icon={<CircleDollarSign className="text-red-400" />}
          />
        </div>

        {/* ── Platforms ── */}
        {data.platforms.length > 0 && (
          <div className="flex items-center gap-3 mb-6 flex-wrap animate-fade-in" style={{ animationDelay: "0.12s" }}>
            <span className="text-xs font-semibold text-slate-500">Sources:</span>
            {data.platforms.map(p => (
              <span key={p} className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-surface-2 text-slate-300">
                {p.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}

        <Separator className="mb-6" />

        {/* ── Sample Reviews ── */}
        <div className="animate-fade-in" style={{ animationDelay: "0.16s" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-100">Sample Reviews</h3>
            {data.sample_reviews.length > 1 && (
              <div className="flex gap-1">
                {data.sample_reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveReview(i)}
                    type="button"
                    aria-label={`Show review ${i + 1}`}
                    aria-pressed={i === activeReview}
                    className={`h-2 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      i === activeReview ? "bg-[#A99FFF] w-5" : "w-2 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {data.sample_reviews.length > 0 ? (
              data.sample_reviews.map((review, i) => (
                <button
                  type="button"
                  key={i}
                  id={`review-${i}`}
                  className={`w-full text-left border-l-2 rounded-r-xl px-4 py-3.5 text-sm text-slate-400 italic leading-relaxed transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    i === activeReview
                      ? "border-primary bg-surface-2 text-slate-300"
                      : "border-white/15 bg-surface hover:border-white/25"
                  }`}
                  onClick={() => setActiveReview(i)}
                >
                  &ldquo;{review}&rdquo;
                </button>
              ))
            ) : (
              <EmptyState
                compact
                title="No sample reviews"
                description="Evidence for this issue doesn’t include quoted reviews yet."
              />
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 mt-8 flex-wrap">
          <Button asChild id="btn-view-in-roadmap-bottom">
            <Link href={`/dashboard/${sessionId}/roadmap`}>View in Roadmap</Link>
          </Button>
          <Button asChild variant="outline" id="btn-ask-about-issue-bottom">
            <Link href={`/dashboard/${sessionId}/meeting`}>Ask AI about this issue</Link>
          </Button>
        </div>
      </WorkspacePage>
    </div>
  );
}
