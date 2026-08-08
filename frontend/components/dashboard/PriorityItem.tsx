"use client";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import type { IssueCluster } from "@/lib/types";

interface PriorityItemProps {
  cluster: IssueCluster;
  sessionId: string;
  rank: number;
}

export function PriorityItem({ cluster, sessionId, rank }: PriorityItemProps) {
  const score = (() => {
    const raw = cluster.priority_score || 0;
    return Math.round(raw <= 1.5 ? raw * 100 : raw);
  })();

  return (
    <Link
      href={`/dashboard/${sessionId}/evidence/${cluster.issue_key}`}
      id={`priority-${cluster.issue_key}`}
      className="group flex items-center gap-4 px-5 py-4 rounded-[16px] border border-border bg-surface hover:bg-surface-2 hover:border-primary/35 transition-all duration-150 cursor-pointer no-underline hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {/* Rank */}
      <span className="text-xs font-extrabold font-mono text-slate-600 min-w-[28px] group-hover:text-slate-400 transition-colors">
        #{rank}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-bold text-sm text-slate-100 truncate">
            {cluster.issue_key.replace(/_/g, " ")}
          </span>
          <CategoryBadge category={cluster.category} />
        </div>
        <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
          <span>{cluster.review_count} reviews</span>
          {cluster.revenue_at_risk > 0 && (
            <span className="text-red-400">₹{(cluster.revenue_at_risk / 1000).toFixed(0)}K at risk</span>
          )}
          {cluster.premium_user_count > 0 && (
            <span className="text-primary-soft">{cluster.premium_user_count} premium</span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-base font-extrabold font-mono text-primary-soft leading-none">{score}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">score</div>
        </div>
        <span className="text-slate-500 group-hover:text-primary-soft transition-colors" aria-hidden>→</span>
      </div>
    </Link>
  );
}
