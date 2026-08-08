/**
 * Landing visuals — teach "priority ≠ volume" then route into analytics.
 */

import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

export function PriorityContrastExample() {
  return (
    <div
      className="rounded-[18px] border border-white/[0.08] bg-[#12161F] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      aria-label="Example: volume is not the same as business priority"
    >
      <div className="px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-[#6D5DF6]/15 to-transparent">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Priority is not volume
        </p>
        <p className="text-[14px] text-slate-200 mt-1.5 leading-snug font-medium">
          RoadmapAI ranks by business impact — not complaint count alone.
        </p>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-0 items-stretch">
        <article className="p-5 border-b sm:border-b-0 sm:border-r border-white/[0.06] bg-red-500/[0.04]">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-[16px] font-bold text-white tracking-tight">
              Payment Failure
            </h3>
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide border bg-red-500/20 text-red-300 border-red-500/40">
              CRITICAL
            </span>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3 items-baseline">
              <dt className="text-slate-500">Complaints</dt>
              <dd className="font-mono font-semibold text-slate-200">35</dd>
            </div>
            <div className="flex justify-between gap-3 items-baseline">
              <dt className="text-slate-500">Est. revenue exposure</dt>
              <dd className="font-mono font-bold text-red-400 text-base inline-flex items-center gap-1">
                <TrendingUp className="size-3.5" strokeWidth={2.5} />
                ₹3.8L
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-[12px] text-slate-400 leading-relaxed border-t border-white/[0.06] pt-3">
            Fewer mentions, high revenue exposure →{" "}
            <span className="text-red-300 font-semibold">fix first</span>.
          </p>
        </article>

        <div className="hidden sm:flex items-center justify-center px-2.5 bg-[#0E1219]">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
            vs
          </span>
        </div>
        <div className="sm:hidden px-4 py-2 text-center border-b border-white/[0.06] bg-[#0E1219]">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
            versus
          </span>
        </div>

        <article className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-[16px] font-bold text-white tracking-tight">
              Dark Mode
            </h3>
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide border bg-slate-500/15 text-slate-400 border-slate-500/30">
              LOW
            </span>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3 items-baseline">
              <dt className="text-slate-500">Requests</dt>
              <dd className="font-mono font-semibold text-slate-200">521</dd>
            </div>
            <div className="flex justify-between gap-3 items-baseline">
              <dt className="text-slate-500">Revenue impact</dt>
              <dd className="font-mono font-semibold text-slate-500 inline-flex items-center gap-1">
                <TrendingDown className="size-3.5" strokeWidth={2.5} />
                Low
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-[12px] text-slate-400 leading-relaxed border-t border-white/[0.06] pt-3">
            High volume, low business exposure →{" "}
            <span className="text-slate-300 font-semibold">defer safely</span>.
          </p>
        </article>
      </div>
    </div>
  );
}

export function PipelineStrip() {
  const steps = ["Collect", "Understand", "Prioritize", "Act", "Measure"] as const;
  return (
    <nav
      aria-label="Product workflow"
      className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-slate-400"
    >
      {steps.map((step, i) => (
        <span key={step} className="inline-flex items-center gap-2">
          <span className="font-semibold text-slate-200">{step}</span>
          {i < steps.length - 1 && (
            <span className="text-slate-600" aria-hidden>
              →
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Mini preview of the analytics dashboard — bridges landing → Overview UX */
export function AnalyticsPreviewCard() {
  return (
    <Link
      href="/business/freshmart-demo"
      className="group block rounded-[18px] border border-[#6D5DF6]/30 bg-gradient-to-br from-[#1a1430] via-[#12161F] to-[#0E1219] p-5 no-underline shadow-[0_0_40px_rgba(109,93,246,0.12)] hover:border-[#6D5DF6]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A99FFF]">
            Analytics workspace
          </p>
          <h3 className="text-[15px] font-bold text-white mt-1 tracking-tight">
            See revenue impact ranked live
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-[#C4BBFF] group-hover:translate-x-0.5 transition-transform">
          Open demo →
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "At risk", value: "₹2.84L", tone: "text-red-400" },
          { label: "Critical", value: "18", tone: "text-amber-300" },
          { label: "Feedback", value: "2,041", tone: "text-emerald-400" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-black/30 border border-white/[0.06] px-2.5 py-2"
          >
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
              {m.label}
            </p>
            <p className={`text-sm font-extrabold font-mono mt-0.5 ${m.tone}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-slate-400 leading-relaxed">
        Same Overview you use after analysis — top issues by ₹ / month, AI “fix first”,
        sentiment, and sprint actions.
      </p>
    </Link>
  );
}

/** @deprecated Prefer PriorityContrastExample on landing hero */
export function DecisionCenterMock() {
  return <PriorityContrastExample />;
}
