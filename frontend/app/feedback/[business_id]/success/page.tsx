"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";

const MODE_CONTENT = {
  reward: {
    icon: "🎁",
    title: "Points Claimed!",
    subtitle: "Thank you for your feedback",
    description: "Your loyalty points will be credited to your account within 24 hours. We appreciate you taking the time to share your experience.",
    color: "amber",
    badge: "Loyalty Points Pending",
    badgeIcon: "⭐",
  },
  improvement: {
    icon: "✅",
    title: "Feedback Received",
    subtitle: "Thank you for helping us improve",
    description: "Your feedback has been recorded and will be reviewed by our team. It is completely confidential and used solely to improve the quality of our services.",
    color: "cyan",
    badge: "Feedback Logged",
    badgeIcon: "💬",
  },
  product: {
    icon: "🚀",
    title: "Feedback Sent!",
    subtitle: "You're shaping the product",
    description: "Your input has been received and will directly influence what our team builds next. Thank you for helping us make this product better.",
    color: "indigo",
    badge: "Added to Roadmap Queue",
    badgeIcon: "🗺️",
  },
} as const;

type Mode = keyof typeof MODE_CONTENT;

function SuccessContent() {
  const params     = useParams();
  const searchParams = useSearchParams();
  const businessId   = params.business_id as string;
  const rawMode      = searchParams.get("mode") as Mode || "improvement";
  const businessName = searchParams.get("biz") || "this business";

  const mode    = (rawMode in MODE_CONTENT ? rawMode : "improvement") as Mode;
  const content = MODE_CONTENT[mode];

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
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[100px] opacity-30 ${
          content.color === "amber" ? "bg-amber-500/20" : content.color === "cyan" ? "bg-cyan-500/15" : "bg-indigo-500/20"
        }`} />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">

        {/* Success card */}
        <div className={`bg-[#0d0f1a]/90 border border-white/8 rounded-3xl p-8 sm:p-10 backdrop-blur-xl ${glowMap[content.color]}`}>

          {/* Icon with pulse animation */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${
              content.color === "amber" ? "bg-amber-500/15 border border-amber-500/30" :
              content.color === "cyan"  ? "bg-cyan-500/15 border border-cyan-500/30" :
                                          "bg-indigo-500/15 border border-indigo-500/30"
            }`}>
              {content.icon}
            </div>
            {/* Animated ring */}
            <div className={`absolute inset-0 rounded-2xl border-2 animate-ping opacity-20 ${
              content.color === "amber" ? "border-amber-400" : content.color === "cyan" ? "border-cyan-400" : "border-indigo-400"
            }`} />
          </div>

          {/* Badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold mb-4 ${colorMap[content.color]}`}>
            <span>{content.badgeIcon}</span>
            {content.badge}
          </div>

          <h1 className="text-2xl font-black text-slate-100 mb-2">{content.title}</h1>
          <p className={`text-sm font-semibold mb-4 ${
            content.color === "amber" ? "text-amber-400" : content.color === "cyan" ? "text-cyan-400" : "text-indigo-400"
          }`}>{content.subtitle}</p>
          <p className="text-sm text-slate-400 leading-relaxed mb-8">{content.description}</p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Link
              href={`/feedback/${businessId}`}
              className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all text-center no-underline ${
                content.color === "amber" ? "bg-amber-500 hover:bg-amber-400 text-black" :
                content.color === "cyan"  ? "bg-cyan-600 hover:bg-cyan-500 text-white" :
                                            "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              Submit Another Feedback
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-700 mt-6">
          Feedback collected by <span className="text-slate-500 font-semibold">{decodeURIComponent(businessName)}</span> via{" "}
          <span className="text-slate-500 font-semibold">RoadmapAI</span>
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
