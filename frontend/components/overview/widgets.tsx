"use client";

import Link from "next/link";
import {
  Inbox,
  Brain,
  ListOrdered,
  Rocket,
  LineChart,
  Bot,
  Check,
  RefreshCw,
  Layers,
  Sparkles,
  Star,
  Map,
  ShoppingCart,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Sparkline, seededSparkline } from "./Sparkline";
import { cn } from "@/lib/utils";
import {
  formatRisk,
  issueTitle,
  priorityScore100,
  issueRevenueImpact,
  issueAffectedCustomers,
  issueReachPct,
} from "@/components/decision-center/helpers";
import type { IssueCluster } from "@/lib/types";

export function OverviewHero({
  name,
  lastUpdated,
  onRefresh,
  newAnalysisHref,
}: {
  name: string;
  lastUpdated?: string;
  onRefresh?: () => void;
  newAnalysisHref: string;
}) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 mb-7">
      <div className="min-w-0 max-w-3xl">
        <p className="text-[15px] text-slate-400 mb-2.5">
          Welcome back, {name.split(" ")[0]}!{" "}
          <span aria-hidden className="inline-block origin-[70%_70%] animate-[wave_1.2s_ease-in-out_infinite]">
            👋
          </span>
        </p>
        <h1 className="text-[1.75rem] md:text-[2.15rem] font-extrabold tracking-[-0.03em] text-white leading-[1.15]">
          Turn customer feedback into{" "}
          <span
            className="bg-gradient-to-r from-[#8B7FF8] via-[#A78BFA] to-[#38BDF8] bg-clip-text text-transparent"
          >
            revenue-driving
          </span>{" "}
          decisions.
        </h1>
        <p className="mt-3 text-[13px] text-slate-500 leading-relaxed max-w-xl">
          Multi-source signals ranked by revenue impact — so your team always knows what to fix first.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { icon: Layers, label: "Multi-source Feedback" },
            { icon: Sparkles, label: "AI-Powered Insights" },
            { icon: LineChart, label: "Revenue Impact" },
            { icon: Map, label: "Actionable Roadmaps" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#161B26] px-3 py-1.5 text-[11px] font-medium text-slate-300"
            >
              <Icon className="size-3.5 text-[#A99FFF]" strokeWidth={2} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {lastUpdated && (
          <span className="text-[12px] text-slate-500 hidden sm:inline whitespace-nowrap">
            Last updated: {lastUpdated}
          </span>
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="w-9 h-9 rounded-xl border border-white/[0.1] bg-[#161B26] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </button>
        )}
        <Button
          asChild
          size="sm"
          className="h-9 rounded-xl px-4 shadow-[0_4px_18px_rgba(109,93,246,0.45)]"
        >
          <Link href={newAnalysisHref}>+ New Analysis</Link>
        </Button>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  countTo,
  countPrefix = "",
  countSuffix = "",
  countDecimals = 0,
  delta,
  deltaTone = "neutral",
  hint,
  sparkColor,
  sparkPoints,
  progress,
  valueClassName,
  glow,
}: {
  label: string;
  value: string;
  countTo?: number;
  countPrefix?: string;
  countSuffix?: string;
  countDecimals?: number;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral" | "warn";
  hint?: string;
  sparkColor?: string;
  sparkPoints?: number[];
  progress?: number;
  valueClassName?: string;
  glow?: "red" | "amber" | "green" | "blue" | "none";
}) {
  const deltaColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    warn: "text-amber-400",
    neutral: "text-slate-400",
  }[deltaTone];

  const glowClass =
    glow === "red"
      ? "shadow-[0_0_24px_rgba(239,68,68,0.12)] border-red-500/20"
      : glow === "amber"
        ? "shadow-[0_0_24px_rgba(245,158,11,0.1)] border-amber-500/15"
        : glow === "green"
          ? "shadow-[0_0_24px_rgba(34,197,94,0.1)] border-emerald-500/15"
          : glow === "blue"
            ? "shadow-[0_0_24px_rgba(109,93,246,0.14)] border-primary/20"
            : "shadow-[0_4px_20px_rgba(0,0,0,0.25)] border-white/[0.07]";

  return (
    <div
      className={cn(
        "rounded-[14px] bg-[#12161F] p-5 min-h-[138px] flex flex-col justify-between border",
        "hover:border-white/[0.12] transition-colors",
        glowClass
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
        {label}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[1.85rem] font-extrabold tracking-tight font-mono leading-none",
              valueClassName || "text-white"
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
          {(delta || hint) && (
            <div className="mt-2.5 space-y-0.5">
              {delta && (
                <p className={cn("text-[12px] font-medium", deltaColor)}>{delta}</p>
              )}
              {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
            </div>
          )}
          {typeof progress === "number" && (
            <div className="mt-3.5 h-[6px] rounded-full bg-white/[0.06] overflow-hidden w-[140px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6D5DF6] to-[#38BDF8]"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </div>
        {sparkPoints && (
          <Sparkline
            points={sparkPoints}
            color={sparkColor}
            className="shrink-0 w-[88px] h-9 mb-0.5"
          />
        )}
      </div>
    </div>
  );
}

export function IssuesTable({
  issues,
  businessId,
}: {
  issues: IssueCluster[];
  businessId: string;
}) {
  const rows = issues.slice(0, 5);
  const maxImpact = Math.max(...rows.map((i) => issueRevenueImpact(i)), 1);

  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-[#12161F] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.25)] h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-white tracking-tight">
            Top Issues by Revenue Impact
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Ranked by estimated ₹ at risk / month — not by complaint volume alone
          </p>
        </div>
        <Link
          href={`/business/${businessId}/analysis`}
          className="text-[12px] font-semibold text-[#A99FFF] hover:text-[#C4BBFF] no-underline shrink-0 mt-0.5"
        >
          View all →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">No ranked issues yet.</div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {[
                  "Issue",
                  "Negative",
                  "Affected Customers",
                  "Revenue Impact",
                  "Priority",
                  "Trend",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((issue, idx) => {
                const score =
                  priorityScore100(issue.priority_score) ??
                  Math.max(20, 95 - idx * 8);
                const negPct = Math.min(
                  98,
                  Math.round(Math.abs(issue.avg_sentiment || 0.3) * 100)
                );
                const affected = issueAffectedCustomers(issue);
                const reachPct = issueReachPct(issue);
                const impact = issueRevenueImpact(issue);
                const barPct = Math.max(8, Math.round((impact / maxImpact) * 100));
                const scoreTone =
                  score >= 80
                    ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : score >= 60
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/35"
                      : "bg-[#6D5DF6]/20 text-[#C4BBFF] border-[#6D5DF6]/30";

                return (
                  <tr
                    key={issue.id || issue.issue_key}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors"
                  >
                    <td className="px-4 py-3.5 min-w-[190px]">
                      <p className="text-[13px] font-semibold text-white leading-tight">
                        {issueTitle(issue.issue_key)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[240px]">
                        {issue.description || issue.category}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-[13px] font-mono font-semibold text-red-400">
                        {issue.review_count}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1">({negPct}%)</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-[13px] font-mono text-slate-200">
                        {affected.toLocaleString()}
                      </span>
                      {reachPct != null && reachPct > 0 && (
                        <span className="text-[11px] text-slate-500 ml-1">
                          ({reachPct}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 min-w-[130px]">
                      <p className="text-[13px] font-mono font-bold text-red-400 whitespace-nowrap">
                        {formatRisk(impact)}
                        <span className="text-[10px] text-slate-500 font-sans font-medium ml-1">
                          / month
                        </span>
                      </p>
                      <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden w-[88px]">
                        <div
                          className="h-full rounded-full bg-red-500/80"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-md text-[11px] font-extrabold border tabular-nums",
                          scoreTone
                        )}
                      >
                        {score}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Sparkline
                        points={seededSparkline(score + idx * 11, 7, idx % 2 === 0 ? "down" : "up")}
                        color={idx === 0 ? "#EF4444" : idx === 1 ? "#F59E0B" : "#6D5DF6"}
                        fill={false}
                        className="w-[64px] h-6"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AiRecommendationCard({
  issue,
  aiRecommendation,
  businessId,
}: {
  issue: IssueCluster | null;
  aiRecommendation?: string;
  businessId: string;
}) {
  if (!issue) {
    return (
      <div className="rounded-[14px] border border-white/[0.07] bg-[#12161F] p-6 h-full flex flex-col items-center justify-center text-center">
        <Bot className="size-8 text-[#A99FFF] mb-3" />
        <p className="text-sm font-bold text-white">AI Recommendation</p>
        <p className="text-xs text-slate-500 mt-2 max-w-[220px]">
          Run an analysis to get a prioritized fix recommendation.
        </p>
      </div>
    );
  }

  const title = issueTitle(issue.issue_key);
  const impact = issueRevenueImpact(issue);
  const affected = issueAffectedCustomers(issue);
  const why = [
    `Highest estimated revenue impact (${formatRisk(impact)} / month)`,
    `Affecting ${affected.toLocaleString()} observed customers`,
    "Clear, actionable fix path for the next sprint",
  ];

  return (
    <div className="rounded-[14px] border border-[#6D5DF6]/30 bg-gradient-to-br from-[#1a1430] via-[#16101f] to-[#12161F] p-5 md:p-6 h-full flex flex-col shadow-[0_0_48px_rgba(109,93,246,0.12)] relative overflow-hidden">
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-[#6D5DF6]/15 blur-3xl pointer-events-none" />
      <div className="absolute right-3 top-3 opacity-90">
        <div className="relative w-[72px] h-[72px]">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#6D5DF6]/40 to-red-500/20 border border-white/10 flex items-center justify-center shadow-lg">
            <ShoppingCart className="size-7 text-white" strokeWidth={1.75} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-red-500/90 flex items-center justify-center shadow-md border border-red-400/40">
            <Clock className="size-3.5 text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A99FFF] mb-2 relative">
        AI Recommendation
      </p>
      <h3 className="text-[1.2rem] md:text-[1.35rem] font-extrabold text-white tracking-tight leading-snug pr-20 relative">
        Fix {title} First
      </h3>
      <p className="text-[12px] text-slate-400 leading-relaxed mt-2.5 mb-4 pr-4 relative">
        This issue has the{" "}
        <span className="text-red-300 font-semibold">highest estimated revenue impact</span>{" "}
        and is hurting the most customers
        {aiRecommendation ? ` — ${aiRecommendation}` : "."}
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-4 relative">
        <div className="rounded-xl bg-black/30 border border-white/[0.07] p-3">
          <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            Revenue at risk
          </p>
          <p className="text-[1.05rem] font-extrabold font-mono text-red-400 mt-1">
            {formatRisk(impact)}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">est. / month</p>
        </div>
        <div className="rounded-xl bg-black/30 border border-white/[0.07] p-3">
          <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            Negative feedback
          </p>
          <p className="text-[1.05rem] font-extrabold font-mono text-white mt-1">
            {issue.review_count}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {affected.toLocaleString()} customers
          </p>
        </div>
      </div>

      <p className="text-[11px] font-bold text-slate-200 mb-2 relative">Why this matters?</p>
      <ul className="space-y-1.5 mb-5 relative">
        {why.map((w) => (
          <li key={w} className="flex items-start gap-2 text-[11px] text-slate-400">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Check className="size-2.5 text-emerald-400" strokeWidth={3} />
            </span>
            {w}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 relative">
        <Button asChild size="sm" className="rounded-xl flex-1 min-w-[120px] shadow-[0_4px_14px_rgba(109,93,246,0.4)]">
          <Link href={`/business/${businessId}/sprint`}>Create Sprint →</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-xl flex-1 min-w-[110px] border-white/15">
          <Link href={`/business/${businessId}/analysis`}>View Evidence</Link>
        </Button>
      </div>
    </div>
  );
}

export function RecentFeedbackList({
  items,
}: {
  items: Array<{
    id: string;
    text: string;
    category?: string;
    rating?: number | null;
    time?: string;
    tone?: "neg" | "pos" | "neu";
  }>;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-white tracking-tight">Recent Feedback</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Latest customer signals</p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">No recent feedback yet.</p>
      ) : (
        <ul className="space-y-2.5 flex-1 overflow-auto pr-0.5">
          {items.map((item) => {
            const dot =
              item.tone === "pos"
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                : item.tone === "neu"
                  ? "bg-amber-400"
                  : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]";
            return (
              <li
                key={item.id}
                className="flex gap-3 rounded-xl border border-white/[0.05] bg-[#0E1219] p-3 hover:border-white/[0.1] transition-colors"
              >
                <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", dot)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-300 leading-snug line-clamp-2">
                    {item.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {item.category && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#6D5DF6]/15 text-[#A99FFF] border border-[#6D5DF6]/25">
                        {item.category}
                      </span>
                    )}
                    {typeof item.rating === "number" && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
                        <Star className="size-2.5 fill-amber-400" />
                        {item.rating}
                      </span>
                    )}
                    {item.time && (
                      <span className="text-[10px] text-slate-600 ml-auto">{item.time}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function JourneyStepper() {
  const steps = [
    { label: "Collect Feedback", icon: Inbox, color: "text-sky-400 bg-sky-500/15 border-sky-500/30" },
    { label: "AI Analysis", icon: Brain, color: "text-[#A99FFF] bg-[#6D5DF6]/15 border-[#6D5DF6]/30" },
    { label: "Prioritize", icon: ListOrdered, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
    { label: "Take Action", icon: Rocket, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
    { label: "Measure Impact", icon: LineChart, color: "text-violet-300 bg-violet-500/15 border-violet-500/30" },
  ];

  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-[#12161F] p-5 md:px-6 md:py-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
      <h3 className="text-[14px] font-bold text-white tracking-tight mb-5">
        Your Product Improvement Journey
      </h3>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
                    step.color
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={1.75} />
                </div>
                <span className="text-[12px] font-semibold text-slate-300 truncate">
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden sm:flex flex-1 items-center mx-2 min-w-[16px]">
                  <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-white/5" />
                  <span className="text-slate-600 text-[10px] mx-0.5">›</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FloatingAiHelp({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-2xl",
        "border border-[#6D5DF6]/35 bg-[#12161F]/95 backdrop-blur-xl",
        "px-4 py-3 shadow-[0_10px_40px_rgba(109,93,246,0.3)]",
        "no-underline hover:border-[#6D5DF6]/55 hover:-translate-y-0.5 transition-all",
        "max-w-[270px]"
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-[#6D5DF6]/25 border border-[#6D5DF6]/35 flex items-center justify-center shrink-0">
        <Bot className="size-5 text-[#C4BBFF]" />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-white leading-tight">Need help?</p>
        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
          Ask AI PM Assistant
        </p>
      </div>
    </Link>
  );
}
