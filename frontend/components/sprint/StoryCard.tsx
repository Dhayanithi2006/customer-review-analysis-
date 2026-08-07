"use client";
import { useState } from "react";
import Link from "next/link";
import { PriorityBadge, EffortBadge } from "@/components/shared/CategoryBadge";
import type { SprintStory } from "@/lib/types";

const STORY_POINTS: Record<string, number> = { S: 2, M: 5, L: 8 };

interface StoryCardProps {
  story: SprintStory;
  sessionId: string;
}

export function StoryCard({ story, sessionId }: StoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pts = STORY_POINTS[story.effort] || story.story_points;

  const dotColor = story.priority === "High" ? "#ef4444" : story.priority === "Medium" ? "#f59e0b" : "#10b981";

  return (
    <div
      id={`story-${story.id}`}
      className="group rounded-xl border border-white/7 bg-[#0f111a] p-5 transition-all duration-200 hover:border-white/14 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className="shrink-0 mt-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-500">{story.id}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e2235] text-slate-500 font-semibold">
              {pts}pts · {story.effort === "S" ? "Small" : story.effort === "M" ? "Medium" : "Large"}
            </span>
            <PriorityBadge priority={story.priority} />
          </div>
          <h4 className="text-sm font-bold text-slate-100 leading-snug mb-2">{story.title}</h4>
          <p className="text-xs text-slate-400 italic leading-relaxed">{story.user_story}</p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(o => !o)}
          id={`toggle-${story.id}`}
          className="shrink-0 w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all"
        >
          <span className={`text-xs transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </button>
      </div>

      {/* Expanded: acceptance criteria */}
      {expanded && (
        <div className="mt-4 ml-5 animate-fade-in border-t border-white/7 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">
            Acceptance Criteria
          </p>
          <ul className="space-y-2">
            {story.acceptance_criteria.map((ac, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-400 leading-relaxed">
                <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                {ac}
              </li>
            ))}
          </ul>
          <Link
            href={`/dashboard/${sessionId}/evidence/${story.linked_issue}`}
            id={`evidence-link-${story.id}`}
            className="inline-flex items-center gap-1 mt-4 text-xs text-indigo-400 hover:text-indigo-300 no-underline transition-colors"
          >
            📎 View evidence: {story.linked_issue} →
          </Link>
        </div>
      )}
    </div>
  );
}
