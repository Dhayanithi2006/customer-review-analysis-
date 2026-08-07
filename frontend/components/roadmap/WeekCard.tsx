import Link from "next/link";
import { EffortBadge } from "@/components/shared/CategoryBadge";
import type { RoadmapWeek } from "@/lib/types";

interface WeekCardProps {
  week: RoadmapWeek;
  sessionId: string;
  index: number;
  isLast: boolean;
}

export function WeekCard({ week, sessionId, index, isLast }: WeekCardProps) {
  return (
    <div
      className="relative pl-8 animate-fade-in"
      id={`roadmap-week-${week.week}`}
      style={{ animationDelay: `${index * 0.08}s`, marginBottom: isLast ? 0 : "2rem" }}
    >
      {/* Timeline line */}
      {!isLast && (
        <div
          className="absolute left-[11px] top-10 bottom-[-2rem] w-0.5"
          style={{ background: "linear-gradient(to bottom, #6366f1, transparent)" }}
        />
      )}
      {/* Dot */}
      <div className="absolute left-1 top-6 w-4 h-4 rounded-full bg-indigo-500 border-2 border-[#08090e] shadow-[0_0_8px_rgba(99,102,241,0.6)]" />

      <div className="rounded-2xl border border-white/7 bg-[#0f111a] p-5 ml-2 transition-all duration-200 hover:border-white/14 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] group">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Week {week.week}</p>
            <h3 className="text-base font-bold text-slate-100">{week.theme}</h3>
          </div>
          <EffortBadge effort={week.effort} />
        </div>

        {/* Issue chips */}
        {week.issues.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {week.issues.map(key => (
              <Link
                key={key}
                href={`/dashboard/${sessionId}/evidence/${key}`}
                id={`roadmap-issue-${key}`}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/12 border border-indigo-500/25 text-indigo-300 font-mono no-underline hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all"
              >
                {key}
              </Link>
            ))}
          </div>
        )}

        {/* Rationale */}
        <p className="text-xs text-slate-500 italic leading-relaxed">{week.rationale}</p>
      </div>
    </div>
  );
}
