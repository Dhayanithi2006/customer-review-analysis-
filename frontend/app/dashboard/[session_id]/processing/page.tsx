"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPipelineStatus } from "@/lib/api";
import { Progress } from "@/components/ui/progress";

const STEPS = [
  { step: 1, label: "Removing duplicates & spam",          icon: "🧹", desc: "Cleaning raw review data" },
  { step: 2, label: "Running sentiment analysis (VADER)",  icon: "💬", desc: "Scoring each review" },
  { step: 3, label: "AI categorisation (Gemini)",          icon: "🤖", desc: "Classifying issues with AI" },
  { step: 4, label: "Clustering related issues",           icon: "🔗", desc: "Grouping similar feedback" },
  { step: 5, label: "Calculating priority scores",         icon: "📊", desc: "Ranking by impact" },
  { step: 6, label: "Generating executive summary",        icon: "📝", desc: "Writing your brief" },
  { step: 7, label: "Building roadmap & sprint plan",      icon: "🗺️", desc: "Finalising deliverables" },
];

export default function ProcessingPage() {
  const params    = useParams();
  const router    = useRouter();
  const sessionId = params.session_id as string;

  const [status, setStatus] = useState({ step: 0, progress: 5, processed: 0, total: 0, message: "" });
  const [failed, setFailed] = useState(false);
  const [done, setDone]     = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await getPipelineStatus(sessionId);
        setStatus(s);
        if (s.status === "complete") {
          clearInterval(interval);
          setDone(true);
          setTimeout(() => router.push(`/dashboard/${sessionId}`), 1200);
        }
        if (s.status === "failed") {
          clearInterval(interval);
          setFailed(true);
        }
      } catch { /* network blip — keep polling */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-[#08090e] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/6 rounded-full blur-[120px] animate-glow" />
      </div>

      <div className="relative w-full max-w-lg animate-fade-in-up">
        <div className="rounded-2xl border border-white/10 bg-[#0f111a] shadow-[0_0_80px_rgba(0,0,0,0.6)] p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">
              {failed ? "❌" : done ? "✅" : (
                <div className="relative inline-flex">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mx-auto" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">⚙️</div>
                </div>
              )}
            </div>
            <h2 className="text-2xl font-black mb-2">
              {failed ? "Analysis failed" : done ? "Analysis complete!" : "Analysing your reviews…"}
            </h2>
            <p className="text-slate-400 text-sm">
              {failed
                ? (status.message || "An error occurred. Please try again.")
                : done
                ? "Redirecting to your dashboard…"
                : status.total > 0
                ? `${status.processed.toLocaleString()} of ${status.total.toLocaleString()} reviews processed`
                : "Getting started…"}
            </p>
          </div>

          {/* Progress bar */}
          {!failed && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500 font-medium">Progress</span>
                <span className="text-xs font-black font-mono text-indigo-400">{status.progress}%</span>
              </div>
              <Progress value={status.progress} />
            </div>
          )}

          {/* Step list */}
          <div className="space-y-2">
            {STEPS.map(s => {
              const done    = s.step < status.step;
              const current = s.step === status.step;
              const future  = s.step > status.step;

              return (
                <div
                  key={s.step}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
                    current
                      ? "bg-indigo-500/8 border-indigo-500/25 shadow-[0_0_0_1px_rgba(99,102,241,0.1)]"
                      : done
                      ? "bg-emerald-500/5 border-emerald-500/15"
                      : "border-transparent"
                  } ${future ? "opacity-30" : ""}`}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-lg">
                    {done ? "✅" : s.icon}
                  </div>

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${
                      done ? "text-emerald-400" : current ? "text-slate-100" : "text-slate-500"
                    }`}>
                      {s.label}
                    </p>
                    {current && (
                      <p className="text-xs text-indigo-400 mt-0.5 animate-fade-in">{s.desc}</p>
                    )}
                  </div>

                  {/* Spinner */}
                  {current && (
                    <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Failed action */}
          {failed && (
            <button
              className="w-full mt-6 py-3 rounded-xl border border-white/15 bg-transparent text-slate-300 text-sm font-semibold hover:bg-[#161827] transition-all"
              onClick={() => window.history.back()}
            >
              ← Try again
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          ☕ This usually takes 2–4 minutes for 1,000 reviews.
        </p>
      </div>
    </div>
  );
}
