"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getEvidence } from "@/lib/api";
import type { EvidenceData } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageLoader } from "@/components/shared/PageLoader";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const SEVERITY_COLOR = (s: number) =>
  s >= 8 ? "#ef4444" : s >= 5 ? "#f59e0b" : "#10b981";

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
    <div className="min-h-screen bg-[#08090e]">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title="Evidence Panel"
        sessionId={sessionId}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/roadmap`} id="btn-view-in-roadmap">🗺️ Roadmap</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/meeting`} id="btn-ask-about-issue">🎤 Ask AI</Link>
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-screen-md px-6 py-8">
        {/* ── Header ── */}
        <div className="animate-fade-in mb-8">
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <CategoryBadge category={data.category} />
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-slate-400 bg-[#161827]">
              {data.business_area}
            </span>
            {data.priority_rank && (
              <span className="text-xs font-mono text-slate-500">Priority #{data.priority_rank}</span>
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-100 mb-2">
            {issueKey.replace(/_/g, " ")}
          </h1>
          <p className="text-slate-400 leading-relaxed">{data.description}</p>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 animate-fade-in" style={{ animationDelay: "0.08s" }}>
          <MetricCard
            label="Confidence"
            value={`${data.confidence}%`}
            accentColor={data.confidence >= 80 ? "#10b981" : "#f59e0b"}
            icon={data.confidence >= 80 ? "✅" : "⚠️"}
          />
          <MetricCard
            label="Evidence"
            value={`${data.review_count} reviews`}
            icon="📋"
          />
          <MetricCard
            label="Premium Users"
            value={`${data.premium_user_count} affected`}
            accentColor="#22d3ee"
            icon="⭐"
          />
          <div className="rounded-2xl border border-white/7 bg-[#0f111a] p-5 col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Avg Severity</p>
            <p className="text-2xl font-black" style={{ color: SEVERITY_COLOR(data.avg_severity || 5) }}>
              {(data.avg_severity || 0).toFixed(1)}<span className="text-base text-slate-500">/10</span>
            </p>
            <SeverityBar value={data.avg_severity || 5} />
          </div>
          <MetricCard
            label="Revenue at Risk"
            value={`₹${((data.revenue_at_risk || 0) / 1000).toFixed(1)}K`}
            accentColor="#ef4444"
            icon="🔴"
          />
        </div>

        {/* ── Platforms ── */}
        {data.platforms.length > 0 && (
          <div className="flex items-center gap-3 mb-6 flex-wrap animate-fade-in" style={{ animationDelay: "0.12s" }}>
            <span className="text-xs font-semibold text-slate-500">Sources:</span>
            {data.platforms.map(p => (
              <span key={p} className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-[#161827] text-slate-300">
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
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      i === activeReview ? "bg-indigo-400 w-5" : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {data.sample_reviews.length > 0 ? (
              data.sample_reviews.map((review, i) => (
                <div
                  key={i}
                  id={`review-${i}`}
                  className={`border-l-2 rounded-r-xl px-4 py-3.5 text-sm text-slate-400 italic leading-relaxed transition-all duration-200 cursor-pointer ${
                    i === activeReview
                      ? "border-indigo-500 bg-[#161827] text-slate-300"
                      : "border-white/15 bg-[#0f111a] hover:border-white/25"
                  }`}
                  onClick={() => setActiveReview(i)}
                >
                  &ldquo;{review}&rdquo;
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">No sample reviews available.</p>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 mt-8 flex-wrap">
          <Button asChild id="btn-view-in-roadmap-bottom">
            <Link href={`/dashboard/${sessionId}/roadmap`}>🗺️ View in Roadmap</Link>
          </Button>
          <Button asChild variant="outline" id="btn-ask-about-issue-bottom">
            <Link href={`/dashboard/${sessionId}/meeting`}>🎤 Ask AI about this issue</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
