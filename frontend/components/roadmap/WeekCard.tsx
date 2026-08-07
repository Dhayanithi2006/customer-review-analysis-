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
          style={{ background: "linear-gradient(to bottom, #6D5DF6, transparent)" }}
        />
      )}
      {/* Dot */}
      <div className="absolute left-1 top-6 w-4 h-4 rounded-full bg-primary border-2 border-[#0B1020] shadow-[0_0_0_4px_rgba(109,93,246,0.18)]" />

      <div className="rounded-[18px] border border-border bg-surface p-5 ml-2 card-elevated hover-lift group">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Week {week.week}</p>
            <h3 className="text-base font-bold text-white">{week.theme}</h3>
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
                className="text-xs px-2.5 py-1 rounded-lg bg-primary/12 border border-primary/25 text-primary-soft-2 font-mono no-underline hover:bg-primary/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
