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
  const score = Math.round(cluster.priority_score * 100);

  return (
    <Link
      href={`/dashboard/${sessionId}/evidence/${cluster.issue_key}`}
      id={`priority-${cluster.issue_key}`}
      className="group flex items-center gap-4 px-5 py-4 rounded-xl border border-white/7 bg-[#0f111a] hover:bg-[#161827] hover:border-indigo-500/40 transition-all duration-150 cursor-pointer no-underline hover:shadow-[0_0_0_1px_rgba(99,102,241,0.15)] hover:translate-x-0.5"
    >
      {/* Rank */}
      <span className="text-xs font-black font-mono text-slate-600 min-w-[28px] group-hover:text-slate-400 transition-colors">
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
          <span>📊 {cluster.review_count} reviews</span>
          {cluster.revenue_at_risk > 0 && (
            <span className="text-red-400">₹{(cluster.revenue_at_risk / 1000).toFixed(0)}K at risk</span>
          )}
          {cluster.premium_user_count > 0 && (
            <span className="text-cyan-400">⭐ {cluster.premium_user_count} premium</span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-base font-black font-mono text-indigo-400 leading-none">{score}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">score</div>
        </div>
        <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">→</span>
      </div>
    </Link>
  );
}
