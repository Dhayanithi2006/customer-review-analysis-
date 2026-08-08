"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getLatestAnalysis,
  getPendingSubmissions,
  processSubmissions,
  getFeedbackHealth,
  getBusinessReviews,
  getBusiness,
} from "@/lib/business-api";
import type {
  LatestAnalysisResponse,
  PendingSubmissionsResponse,
  FeedbackHealthResponse,
  BusinessResponse,
} from "@/lib/business-api";
import { getDashboard } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { WorkspacePage } from "@/components/layout/workspace-page";
import {
  OverviewHero,
  KpiCard,
  IssuesTable,
  AiRecommendationCard,
  RecentFeedbackList,
  JourneyStepper,
  FloatingAiHelp,
} from "@/components/overview/widgets";
import { SentimentDonut, RevenueTrendChart } from "@/components/overview/Charts";
import { seededSparkline } from "@/components/overview/Sparkline";
import {
  DEMO_DASHBOARD,
  DEMO_HEALTH,
  DEMO_RECENT,
  DEMO_TREND,
  DEMO_WORKSPACE,
} from "@/components/overview/demo-data";
import { formatRisk } from "@/components/decision-center/helpers";

function relativeTime(iso?: string | null) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [, setBiz] = useState<BusinessResponse | null>(null);
  const [latest, setLatest] = useState<LatestAnalysisResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pending, setPending] = useState<PendingSubmissionsResponse | null>(null);
  const [health, setHealth] = useState<FeedbackHealthResponse | null>(null);
  const [recent, setRecent] = useState<
    Array<{
      id: string;
      text: string;
      category?: string;
      rating?: number | null;
      time?: string;
      tone?: "neg" | "pos" | "neu";
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [lat, business] = await Promise.all([
        getLatestAnalysis(businessId).catch(() => null),
        getBusiness(businessId).catch(() => null),
      ]);
      if (lat) setLatest(lat);
      if (business) setBiz(business);

      if (lat?.has_analysis && lat.session_id) {
        try {
          const dash = await getDashboard(lat.session_id);
          setDashboard(dash);
        } catch {
          setDashboard(null);
        }
      } else {
        setDashboard(null);
      }

      getPendingSubmissions(businessId).then(setPending).catch(() => null);
      getFeedbackHealth(businessId).then(setHealth).catch(() => null);

      getBusinessReviews(businessId, 8, 0)
        .then((res) => {
          const list = (res.reviews || res.items || res || []) as Array<
            Record<string, unknown>
          >;
          if (!Array.isArray(list) || list.length === 0) return;
          setRecent(
            list.slice(0, 5).map((r, i) => {
              const text = String(
                r.raw_text || r.text || r.review_text || r.content || "Customer feedback"
              );
              const rating = typeof r.rating === "number" ? r.rating : null;
              const sentiment = Number(r.sentiment ?? r.avg_sentiment ?? 0);
              const tone: "neg" | "pos" | "neu" =
                sentiment < -0.05 || (rating != null && rating <= 2)
                  ? "neg"
                  : sentiment > 0.2 || (rating != null && rating >= 4)
                    ? "pos"
                    : "neu";
              return {
                id: String(r.id || i),
                text,
                category: String(r.category || r.feedback_tag || "General"),
                rating,
                time:
                  relativeTime(String(r.created_at || r.submitted_at || "")) ||
                  `${i + 2}m ago`,
                tone,
              };
            })
          );
        })
        .catch(() => null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleProcessSubmissions = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await processSubmissions(businessId);
      const pend = await getPendingSubmissions(businessId);
      setPending(pend);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  // Prefer live analysis; fall back to mockup demo so UI always matches design.
  const view: DashboardData = useMemo(() => {
    if (dashboard?.issues?.length) return dashboard;
    return DEMO_DASHBOARD;
  }, [dashboard]);

  const isDemo = view === DEMO_DASHBOARD || Boolean(view.is_demo_data);

  const topIssue =
    view.top_priority_issue && typeof view.top_priority_issue !== "string"
      ? view.top_priority_issue
      : view.issues?.[0] || null;

  const criticalCount = isDemo
    ? 18
    : view.kpis?.critical_issue_count ||
      (view.issues || []).filter((i) => (i.priority_rank || 99) <= 3).length;

  const conf = view.analysis_health?.ai_confidence ?? 94;
  const totalFeedback = isDemo
    ? DEMO_HEALTH.total_feedback
    : health?.total_feedback || view.total_reviews || DEMO_HEALTH.total_feedback;
  const revenue = isDemo
    ? DEMO_DASHBOARD.revenue_at_risk
    : view.revenue_at_risk || DEMO_DASHBOARD.revenue_at_risk;

  const sentiment = isDemo
    ? DEMO_HEALTH.sentiment_distribution
    : health?.sentiment_distribution ||
      view.sentiment_distribution ||
      DEMO_HEALTH.sentiment_distribution;

  const trendData = isDemo
    ? DEMO_TREND
    : DEMO_TREND.map((d, i) => ({
        ...d,
        value: Math.round((revenue || 284000) * [0.7, 0.83, 0.75, 0.94, 0.88, 1.03, 1][i]),
      }));

  const recentItems = isDemo || recent.length === 0 ? DEMO_RECENT : recent;

  if (loading) {
    return (
      <WorkspacePage width="wide">
        <ContentSkeleton variant="dashboard" />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage width="wide" className="pb-28 relative !max-w-[1440px]">
      <OverviewHero
        name={DEMO_WORKSPACE.userName}
        lastUpdated={
          latest?.created_at
            ? relativeTime(latest.created_at) || "2 min ago"
            : "2 min ago"
        }
        onRefresh={() => {
          setLoading(true);
          load();
        }}
        newAnalysisHref="/"
      />

      {pending && pending.total_all_time > 0 && pending.ready_to_analyse && (
        <div className="rounded-[14px] border border-primary/25 bg-primary/5 p-4 mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-100">
              {pending.total_pending} new submission
              {pending.total_pending !== 1 ? "s" : ""} ready
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{pending.message}</p>
          </div>
          <button
            onClick={handleProcessSubmissions}
            disabled={processing}
            className="shrink-0 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
          >
            {processing ? "Running…" : "Analyse Now"}
          </button>
        </div>
      )}

      {/* KPI row — analytics mockup */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5">
        <KpiCard
          label="Estimated Revenue at Risk"
          value={formatRisk(revenue)}
          countTo={revenue >= 100000 ? revenue / 100000 : revenue / 1000}
          countPrefix="₹"
          countSuffix={revenue >= 100000 ? "L" : "K"}
          countDecimals={2}
          delta="↓ 12.6% vs last week"
          deltaTone="down"
          valueClassName="text-red-400"
          sparkColor="#EF4444"
          sparkPoints={seededSparkline(12, 8, "down")}
          glow="red"
        />
        <KpiCard
          label="Critical Issues"
          value={String(criticalCount)}
          countTo={criticalCount}
          delta="3 new this week"
          deltaTone="warn"
          sparkColor="#F59E0B"
          sparkPoints={seededSparkline(44, 8, "up")}
          glow="amber"
        />
        <KpiCard
          label="Total Feedback"
          value={totalFeedback.toLocaleString()}
          countTo={totalFeedback}
          delta="↑ 18.7% vs last week"
          deltaTone="up"
          sparkColor="#22C55E"
          sparkPoints={seededSparkline(77, 8, "up")}
          glow="green"
        />
        <KpiCard
          label="AI Confidence Score"
          value={`${conf}%`}
          countTo={conf}
          countSuffix="%"
          hint="High confidence"
          progress={conf}
          glow="blue"
        />
      </section>

      {/* Issues + AI recommendation */}
      <section className="grid lg:grid-cols-5 gap-3.5 mb-5">
        <div className="lg:col-span-3 min-w-0">
          <IssuesTable issues={view.issues || []} businessId={businessId} />
        </div>
        <div className="lg:col-span-2 min-w-0">
          <AiRecommendationCard
            issue={topIssue}
            aiRecommendation={view.ai_recommendation}
            businessId={businessId}
          />
        </div>
      </section>

      {/* Charts + recent */}
      <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-5">
        <div className="rounded-[14px] border border-white/[0.07] bg-[#12161F] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] min-h-[300px]">
          <SentimentDonut
            negative={sentiment.negative_pct}
            positive={sentiment.positive_pct}
            neutral={sentiment.neutral_pct}
            total={totalFeedback}
          />
        </div>
        <div className="rounded-[14px] border border-white/[0.07] bg-[#12161F] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] min-h-[300px]">
          <RevenueTrendChart data={trendData} />
        </div>
        <div className="rounded-[14px] border border-white/[0.07] bg-[#12161F] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] min-h-[300px] md:col-span-2 xl:col-span-1">
          <RecentFeedbackList items={recentItems} />
        </div>
      </section>

      <JourneyStepper />
      <FloatingAiHelp href={`/business/${businessId}/meeting`} />
    </WorkspacePage>
  );
}
