"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis } from "@/lib/business-api";
import {
  getDashboard,
  getRoadmap,
  getSprint,
  recordBusinessAction,
  sendFollowups,
  getResolutionImpact,
} from "@/lib/api";
import type { ResolutionImpact } from "@/lib/api";
import type { DashboardData, IssueCluster } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import { WorkspacePage } from "@/components/layout/workspace-page";
import {
  TopIssueHero,
  ImpactSummary,
  PriorityList,
  PriorityMatrix,
  EvidencePanel,
  RevenueImpactChart,
  AssumptionsPanel,
  SentimentStrip,
  issueTitle,
  priorityScore100,
  sortIssuesForAttention,
} from "@/components/decision-center";
import { getBusiness } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";
import { DEMO_DASHBOARD } from "@/components/overview/demo-data";

interface RoadmapWeekLite {
  week: number;
  theme: string;
  tasks?: string[];
  issues?: string[];
  effort?: string;
  rationale?: string;
}

interface StoryLite {
  title?: string;
  user_story?: string;
  description?: string;
  story_points?: number;
  priority?: string;
}

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

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionIssue, setActionIssue] = useState<IssueCluster | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [actionStatus, setActionStatus] = useState<"ACTION_PLANNED" | "ACTION_TAKEN">("ACTION_TAKEN");
  const [savingAction, setSavingAction] = useState(false);
  const [impacts, setImpacts] = useState<Record<string, ResolutionImpact>>({});
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessResponse | null>(null);

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

        const [dash, road, sprint, biz] = await Promise.all([
          getDashboard(sid),
          getRoadmap(sid).catch(() => ({ roadmap: [] })),
          getSprint(sid).catch(() => ({ sprint: null })),
          getBusiness(businessId).catch(() => null),
        ]);

        setDashboard(dash);
        if (biz) setBusiness(biz);
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

        // Prefetch closed-loop statuses for priority cards (best-effort)
        const impactEntries = await Promise.all(
          issues.slice(0, 12).map(async (issue) => {
            try {
              const data = await getResolutionImpact(businessId, issue.issue_key);
              return [issue.issue_key, data] as const;
            } catch {
              return null;
            }
          })
        );
        const nextImpacts: Record<string, ResolutionImpact> = {};
        for (const entry of impactEntries) {
          if (entry) nextImpacts[entry[0]] = entry[1];
        }
        if (Object.keys(nextImpacts).length) {
          setImpacts((prev) => ({ ...prev, ...nextImpacts }));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId, sessionParam]);

  useEffect(() => {
    if (!selectedKey || !businessId) return;
    getResolutionImpact(businessId, selectedKey)
      .then((data) => {
        setImpacts((prev) => ({ ...prev, [selectedKey]: data }));
      })
      .catch(() => null);
  }, [businessId, selectedKey]);

  const handleOpenActionModal = (issue: IssueCluster) => {
    setActionIssue(issue);
    setActionInput(impacts[issue.issue_key]?.action_taken || "");
    const current = impacts[issue.issue_key]?.status;
    setActionStatus(current === "ACTION_PLANNED" ? "ACTION_PLANNED" : "ACTION_TAKEN");
    setActionModalOpen(true);
  };

  const handleSaveAction = async () => {
    if (!actionIssue || !actionInput.trim() || savingAction) return;
    setSavingAction(true);
    try {
      const result = await recordBusinessAction(
        businessId,
        actionIssue.issue_key,
        actionInput.trim(),
        actionStatus
      );
      const updatedImpact = await getResolutionImpact(businessId, actionIssue.issue_key);
      setImpacts((prev) => ({ ...prev, [actionIssue.issue_key]: updatedImpact }));
      setActionModalOpen(false);
      const verb = actionStatus === "ACTION_PLANNED" ? "Action planned" : "Action taken";
      const followupNote =
        result.followup?.followups_triggered
          ? ` · ${result.followup.sent_count || 0} follow-up(s) sent`
          : result.followup?.message
          ? ` · ${result.followup.message}`
          : "";
      setActionNotice(
        `${verb} for ${actionIssue.issue_key.replace(/_/g, " ")}${followupNote}`
      );
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: unknown) {
      setActionNotice(err instanceof Error ? err.message : "Failed to save action");
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setSavingAction(false);
    }
  };

  const handleSendFollowups = async (issueKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sendingFollowup) return;
    setSendingFollowup(true);
    try {
      const res = await sendFollowups(businessId, issueKey);
      setActionNotice(res.message || "Follow-up requests sent.");
      setTimeout(() => setActionNotice(null), 5000);
      const updatedImpact = await getResolutionImpact(businessId, issueKey);
      setImpacts((prev) => ({ ...prev, [issueKey]: updatedImpact }));
    } catch (err: unknown) {
      setActionNotice(err instanceof Error ? err.message : "Failed to send followups");
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setSendingFollowup(false);
    }
  };

  const statusByKey = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(impacts)) {
      map[k] = v?.status;
    }
    return map;
  }, [impacts]);

  const activeDashboard: DashboardData = dashboard || DEMO_DASHBOARD;

  const issues = useMemo(() => {
    const raw = (activeDashboard.issues || []) as IssueCluster[];
    return sortIssuesForAttention(raw, statusByKey);
  }, [activeDashboard, statusByKey]);

  const topIssue = useMemo(() => {
    if (activeDashboard.top_priority_issue && typeof activeDashboard.top_priority_issue !== "string") {
      return activeDashboard.top_priority_issue as IssueCluster;
    }
    return issues[0] || null;
  }, [activeDashboard, issues]);

  const selected = useMemo(
    () => issues.find((i) => i.issue_key === selectedKey) || topIssue,
    [issues, selectedKey, topIssue]
  );

  const selectIssue = (issue: IssueCluster) => {
    setSelectedKey(issue.issue_key);
    // Smooth scroll to evidence for <5s decision → evidence path
    requestAnimationFrame(() => {
      document.getElementById("evidence")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const currency =
    activeDashboard.business_assumptions?.currency ||
    activeDashboard.decision_center?.business_assumptions?.currency ||
    business?.currency ||
    "INR";
  const assumptions =
    activeDashboard.business_assumptions ||
    activeDashboard.decision_center?.business_assumptions ||
    (business
      ? {
          monthly_customers: business.monthly_customers,
          avg_revenue_per_user: business.avg_revenue_per_user,
          premium_pct: business.premium_pct,
          currency: business.currency,
          configured: business.monthly_customers > 0 && business.avg_revenue_per_user > 0,
          business_id: business.id,
          edit_path: `/business/${businessId}/settings`,
        }
      : null);
  const fixWhy = activeDashboard.fix_first?.why || activeDashboard.decision_center?.fix_first?.why;
  const sentiment =
    activeDashboard.sentiment_distribution || activeDashboard.decision_center?.sentiment_distribution;

  return (
    <WorkspacePage>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {label && <Badge variant="primary">{label}</Badge>}
        {activeDashboard.is_demo_data && (
          <Badge variant="warning">Demo / sample data</Badge>
        )}
        {activeDashboard.source && !activeDashboard.is_demo_data && (
          <Badge variant="outline">Source: {activeDashboard.source}</Badge>
        )}
      </div>

      {actionNotice && (
        <div className="mb-6 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary-soft font-semibold">
          {actionNotice}
        </div>
      )}

      {/* 1. Top issue — answer in <5 seconds */}
      <TopIssueHero
        issue={topIssue}
        aiRecommendation={activeDashboard.ai_recommendation}
        isDemoData={activeDashboard.is_demo_data}
        totalIssues={issues.length}
        resolutionStatus={topIssue ? statusByKey[topIssue.issue_key] : undefined}
        why={fixWhy}
        currency={currency}
        onViewEvidence={() => {
          if (topIssue) selectIssue(topIssue);
        }}
        onOpenActions={topIssue ? () => handleOpenActionModal(topIssue) : undefined}
      />

      {/* 2. Impact summary cards */}
      <ImpactSummary
        dashboard={activeDashboard}
        topIssue={topIssue}
        issues={issues}
        currency={currency}
      />

      {/* 3. Revenue impact chart */}
      <RevenueImpactChart
        issues={issues}
        currency={currency}
        selectedKey={selectedKey}
        onSelect={selectIssue}
      />

      {/* 4. Priority issues */}
      <PriorityList
        issues={issues}
        selectedKey={selectedKey}
        statusByKey={statusByKey}
        currency={currency}
        onSelect={selectIssue}
      />

      {/* 5. Assumptions */}
      <AssumptionsPanel assumptions={assumptions} businessId={businessId} />

      {/* 6. Sentiment */}
      <SentimentStrip sentiment={sentiment} />

      {/* 7. Priority matrix — revenue × reach */}
      <div className="opacity-95">
        <PriorityMatrix
          issues={issues}
          selectedKey={selectedKey}
          onSelect={selectIssue}
          currency={currency}
        />
      </div>

      {/* 8. Evidence panel */}
      <EvidencePanel
        sessionId={sessionId || "demo-session"}
        issue={selected}
        aiRecommendation={activeDashboard.ai_recommendation}
        impact={selected ? impacts[selected.issue_key] : undefined}
        onPlanAction={handleOpenActionModal}
        onSendFollowup={handleSendFollowups}
        sendingFollowup={sendingFollowup}
      />

      {/* Next steps — secondary to the decision */}
      <section className="mb-8">
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            After you decide
          </p>
          <h3 className="text-lg font-extrabold text-white tracking-tight">
            Turn priority into a plan
          </h3>
        </div>

        {(roadmap.length > 0 || stories.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {roadmap.slice(0, 2).map((week) => (
              <div
                key={week.week}
                className="rounded-[18px] border border-border bg-surface p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Week {week.week}
                </p>
                <p className="text-sm font-bold text-white">{week.theme}</p>
                {week.rationale && (
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{week.rationale}</p>
                )}
              </div>
            ))}
            {stories.slice(0, 2).map((story, i) => (
              <div
                key={i}
                className="rounded-[18px] border border-border bg-surface p-4"
              >
                <p className="text-sm font-bold text-white leading-snug">
                  {story.title || "Untitled story"}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 italic">
                  {story.user_story || story.description || "—"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/business/${businessId}/roadmap`}>Add to Roadmap</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/business/${businessId}/sprint`}>Create Sprint</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/business/${businessId}/meeting`}>AI Product Manager</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href={`/business/${businessId}/exports`}>Export briefing</Link>
          </Button>
        </div>
      </section>

      {/* Closed-loop action modal */}
      {actionModalOpen && actionIssue && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0f1a] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Closed-loop action
                </p>
                <h3 className="text-lg font-bold text-slate-100">
                  {issueTitle(actionIssue.issue_key)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/4 border border-white/5 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-semibold">Priority Rank</span>
              <span className="text-amber-400 font-bold">
                #{actionIssue.priority_rank || 1}
                {priorityScore100(actionIssue.priority_score) != null
                  ? ` · Score: ${priorityScore100(actionIssue.priority_score)}/100`
                  : ""}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-300">Status</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActionStatus("ACTION_PLANNED")}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors",
                    actionStatus === "ACTION_PLANNED"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"
                  )}
                >
                  Action Planned
                </button>
                <button
                  type="button"
                  onClick={() => setActionStatus("ACTION_TAKEN")}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors",
                    actionStatus === "ACTION_TAKEN"
                      ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                      : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"
                  )}
                >
                  Mark Action Taken
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                What did you plan or do?
              </label>
              <textarea
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                placeholder="e.g. Opened 2 additional checkout counters"
                rows={3}
                maxLength={1000}
                className="w-full bg-[#161827] border border-white/10 rounded-2xl p-3.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setActionModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAction} disabled={!actionInput.trim() || savingAction}>
                {savingAction
                  ? "Saving..."
                  : actionStatus === "ACTION_PLANNED"
                  ? "Save Plan"
                  : "Mark Action Taken"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}
