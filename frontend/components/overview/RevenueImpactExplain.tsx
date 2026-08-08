"use client";

import Link from "next/link";
import { Info, IndianRupee, Users, AlertTriangle, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Plain-English explanation of how Estimated Revenue Impact is computed.
 * Matches RoadmapAI mockup intent: money story a PM can understand in seconds.
 */
export function RevenueImpactExplain({
  settingsHref,
  className,
  compact = false,
}: {
  settingsHref?: string;
  className?: string;
  compact?: boolean;
}) {
  const steps = [
    {
      icon: Users,
      title: "Who’s hurt",
      body: "Count customers complaining about this issue",
    },
    {
      icon: IndianRupee,
      title: "What’s at stake",
      body: "Multiply by your avg revenue per customer (ARPU)",
    },
    {
      icon: AlertTriangle,
      title: "How severe",
      body: "Scale by severity risk (mild → critical)",
    },
    {
      icon: Scale,
      title: "What to fix first",
      body: "Rank with reach + tier (not just complaint volume)",
    },
  ];

  return (
    <section
      className={cn(
        "rounded-[14px] border border-[#6D5DF6]/25 bg-gradient-to-r from-[#6D5DF6]/12 via-[#12161F] to-[#12161F]",
        "p-4 md:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]",
        className
      )}
    >
      <div className="flex items-start gap-3 mb-3.5">
        <div className="w-9 h-9 rounded-xl bg-[#6D5DF6]/20 border border-[#6D5DF6]/30 flex items-center justify-center shrink-0">
          <Info className="size-4 text-[#C4BBFF]" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-white tracking-tight">
            How Estimated Revenue Impact works
          </h3>
          <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
            We turn feedback into{" "}
            <span className="text-red-300 font-semibold">₹ at risk / month</span>{" "}
            so you know what to fix first. This is an{" "}
            <span className="text-slate-200 font-medium">estimate</span> from your
            workspace settings — not actual money already lost.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-xl border border-white/[0.06] bg-[#0E1219]/80 p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-extrabold text-[#A99FFF] font-mono">
                    {i + 1}
                  </span>
                  <Icon className="size-3.5 text-[#A99FFF]" strokeWidth={2} />
                  <span className="text-[12px] font-bold text-slate-200">{s.title}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{s.body}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-black/25 border border-white/[0.06] px-3.5 py-2.5">
        <p className="text-[11px] sm:text-[12px] text-slate-300 font-mono leading-relaxed">
          <span className="text-slate-500">Formula → </span>
          <span className="text-white">Affected customers</span>
          <span className="text-slate-500"> × </span>
          <span className="text-white">ARPU</span>
          <span className="text-slate-500"> × </span>
          <span className="text-white">Severity risk</span>
          <span className="text-slate-500"> = </span>
          <span className="text-red-300 font-semibold">Est. ₹ / month</span>
        </p>
        {settingsHref && (
          <Link
            href={settingsHref}
            className="text-[11px] font-semibold text-[#A99FFF] hover:text-[#C4BBFF] no-underline whitespace-nowrap"
          >
            Edit ARPU & customers →
          </Link>
        )}
      </div>
    </section>
  );
}
