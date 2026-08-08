"use client";

import { cn } from "@/lib/utils";

const STAGES = [
  { key: "IDENTIFIED", label: "Identified" },
  { key: "ACTION_TAKEN", label: "Action Taken" },
  { key: "FOLLOW_UP_SENT", label: "Follow-up" },
  { key: "RESOLVED", label: "Improved / Reopened" },
] as const;

function stageIndex(status?: string): number {
  if (!status || status === "IDENTIFIED" || status === "Open") return 0;
  if (status === "ACTION_PLANNED" || status === "ACTION_TAKEN" || status === "In Progress")
    return 1;
  if (status === "FOLLOW_UP_SENT") return 2;
  if (status === "IMPROVED" || status === "REOPENED" || status === "Resolved") return 3;
  return 0;
}

interface LifecycleStripProps {
  status?: string;
  className?: string;
  compact?: boolean;
}

export function LifecycleStrip({ status, className, compact }: LifecycleStripProps) {
  const active = stageIndex(status);
  const isReopened = status === "REOPENED";
  const isImproved = status === "IMPROVED";

  return (
    <div className={cn("w-full", className)} role="status" aria-label={`Lifecycle: ${status || "IDENTIFIED"}`}>
      {!compact && (
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2.5">
          Closed-loop status
        </p>
      )}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {STAGES.map((stage, i) => {
          const done = i < active;
          const current = i === active;
          let label: string = stage.label;
          if (stage.key === "RESOLVED" && isReopened) label = "Reopened";
          if (stage.key === "RESOLVED" && isImproved) label = "Improved";

          return (
            <li key={stage.key} className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold border",
                  current && isReopened && "bg-red-500/15 text-red-300 border-red-500/30",
                  current && isImproved && "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                  current && !isReopened && !isImproved && "bg-primary/15 text-primary-soft border-primary/30",
                  done && "bg-white/[0.04] text-slate-400 border-white/[0.08]",
                  !done && !current && "bg-transparent text-slate-600 border-transparent"
                )}
              >
                {label}
              </span>
              {i < STAGES.length - 1 && (
                <span className="text-slate-700 text-[10px]" aria-hidden>
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
