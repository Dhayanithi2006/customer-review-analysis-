"use client";

import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const MODE_DEFAULTS = {
  reward: {
    icon: "🎁",
    title: "Thank You!",
    badge: "Points Credited",
    color: "amber",
    badgeIcon: "⭐",
  },
  improvement: {
    icon: "✓",
    title: "Thank You",
    badge: "Feedback Logged",
    color: "cyan",
    badgeIcon: "💬",
  },
  product: {
    icon: "✓",
    title: "Feedback Received",
    badge: "Product Roadmap",
    color: "indigo",
    badgeIcon: "🚀",
  },
} as const;

type Mode = keyof typeof MODE_DEFAULTS;

function SuccessContent() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const businessId   = params.business_id as string;
  const rawMode      = searchParams.get("mode") as Mode || "improvement";
  const businessName = searchParams.get("biz") || "the business";
  const customMsg    = searchParams.get("msg");
  const pts          = parseInt(searchParams.get("pts") || "0");
  const bal          = parseInt(searchParams.get("bal") || "0");
  const eligible     = searchParams.get("eligible") !== "false";

  const mode    = (rawMode in MODE_DEFAULTS ? rawMode : "improvement") as Mode;
  const config  = MODE_DEFAULTS[mode];

  // Formulate dynamic message matching Phase 2 & Phase 3 specifications
  let displayMessage = customMsg;
  if (!displayMessage) {
    if (mode === "reward") {
      displayMessage = pts > 0
        ? `You've earned ${pts} points. Your feedback helps us improve your experience.`
        : "Thank you for your feedback! Your submission has been received.";
    } else if (mode === "improvement") {
      displayMessage = "Your feedback helps us improve patient care and service quality.";
    } else {
      displayMessage = "Your feedback can help shape future product improvements.";
    }
  }

  const colorMap: Record<string, string> = {
    amber:  "border-amber-500/25 bg-amber-500/8 text-amber-300",
    cyan:   "border-cyan-500/25 bg-cyan-500/8 text-cyan-300",
    indigo: "border-indigo-500/25 bg-indigo-500/8 text-indigo-300",
  };

  const glowMap: Record<string, string> = {
    amber:  "shadow-[0_0_60px_rgba(245,158,11,0.15)]",
    cyan:   "shadow-[0_0_60px_rgba(6,182,212,0.12)]",
    indigo: "shadow-[0_0_60px_rgba(99,102,241,0.15)]",
  };

  return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center px-4 py-12 relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[100px] opacity-30 ${
          config.color === "amber" ? "bg-amber-500/20" : config.color === "cyan" ? "bg-cyan-500/15" : "bg-indigo-500/20"
        }`} />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <div className={`bg-[#0d0f1a]/95 border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-xl ${glowMap[config.color]}`}>

          {/* Icon with subtle pulse animation */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-bold ${
              config.color === "amber" ? "bg-amber-500/15 border border-amber-500/30 text-amber-400" :
              config.color === "cyan"  ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400" :
                                          "bg-indigo-500/15 border border-indigo-500/30 text-indigo-400"
            }`}>
              {config.icon}
            </div>
            <div className={`absolute inset-0 rounded-2xl border-2 animate-ping opacity-20 ${
              config.color === "amber" ? "border-amber-400" : config.color === "cyan" ? "border-cyan-400" : "border-indigo-400"
            }`} />
          </div>

          {/* Mode Badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold mb-4 ${colorMap[config.color]}`}>
            <span>{config.badgeIcon}</span>
            {config.badge}
          </div>

          <h1 className="text-2xl font-black text-slate-100 mb-3">{config.title}</h1>

          {/* Points Highlight & Balance Ledger Display (REWARD MODE ONLY) */}
          {mode === "reward" && (
            <div className="my-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
              {pts > 0 ? (
                <p className="text-lg font-black text-amber-400">+{pts} Points Earned!</p>
              ) : (
                <p className="text-xs font-semibold text-amber-300/80">Feedback Received (Reward Cooldown Active)</p>
              )}
              {bal > 0 && (
                <p className="text-xs text-amber-200/90 font-mono">
                  Total Balance: <strong>{bal} Points</strong>
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-slate-300 leading-relaxed mb-8 font-medium">
            {displayMessage}
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href={`/feedback/${businessId}/updates`}
              className="w-full py-3.5 rounded-2xl text-sm font-bold border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 transition-all text-center no-underline flex items-center justify-center gap-2"
            >
              <span>📣</span> See Actions Taken (You Said → We Did)
            </Link>
            <Link
              href={`/feedback/${businessId}`}
              className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all text-center no-underline ${
                config.color === "amber" ? "bg-amber-500 hover:bg-amber-400 text-black" :
                config.color === "cyan"  ? "bg-cyan-600 hover:bg-cyan-500 text-white" :
                                            "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              Submit Another Feedback
            </Link>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          Thank you for helping <span className="text-slate-400 font-semibold">{decodeURIComponent(businessName)}</span> serve you better.
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
