"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  X,
  Loader2,
  Filter,
  MessageSquare,
  Sparkles,
  Link2,
  BarChart3,
  FileText,
  Map,
} from "lucide-react";
import { getPipelineStatus } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/lib/toast";

const STEPS = [
  { step: 1, label: "Removing duplicates & spam", icon: Filter, desc: "Cleaning raw review data" },
  { step: 2, label: "Running sentiment analysis", icon: MessageSquare, desc: "Scoring each review" },
  { step: 3, label: "AI categorisation", icon: Sparkles, desc: "Classifying issues with AI" },
  { step: 4, label: "Clustering related issues", icon: Link2, desc: "Grouping similar feedback" },
  { step: 5, label: "Calculating priority scores", icon: BarChart3, desc: "Ranking by business impact" },
  { step: 6, label: "Generating executive summary", icon: FileText, desc: "Writing your briefing" },
  { step: 7, label: "Building roadmap & sprint plan", icon: Map, desc: "Finalising deliverables" },
];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const [status, setStatus] = useState({ step: 0, progress: 5, processed: 0, total: 0, message: "" });
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let completed = false;

    const handleComplete = () => {
      if (completed) return;
      completed = true;
      setDone(true);
      toast.success("Analysis complete", "Dashboard, roadmap, and sprint plan are ready.");
      setTimeout(() => router.push(`/dashboard/${sessionId}`), 1200);
    };

    const handleFail = (msg?: string) => {
      if (completed) return;
      completed = true;
      setFailed(true);
      toast.error("Analysis failed", msg || "An error occurred during processing.");
    };

    try {
      es = new EventSource(`${BASE_URL}/pipeline/${sessionId}/status`);

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.error) {
            es?.close();
            startPolling();
            return;
          }
          setStatus(payload);
          if (payload.status === "complete") {
            es?.close();
            handleComplete();
          } else if (payload.status === "failed") {
            es?.close();
            handleFail(payload.message);
          }
        } catch {
          /* ignore parse error */
        }
      };

      es.onerror = () => {
        es?.close();
        if (!completed) startPolling();
      };
    } catch {
      startPolling();
    }

    function startPolling() {
      if (pollInterval || completed) return;
      pollInterval = setInterval(async () => {
        try {
          const s = await getPipelineStatus(sessionId);
          setStatus(s);
          if (s.status === "complete") {
            if (pollInterval) clearInterval(pollInterval);
            handleComplete();
          } else if (s.status === "failed") {
            if (pollInterval) clearInterval(pollInterval);
            handleFail(s.message);
          }
        } catch {
          /* network blip — keep polling */
        }
      }, 1500);
    }

    return () => {
      if (es) es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.06] rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-lg animate-fade-in-up">
        <div
          className="rounded-[20px] border border-white/[0.08] bg-surface shadow-[0_8px_28px_rgba(0,0,0,0.36)] p-8"
          role="status"
          aria-live="polite"
          aria-busy={!failed && !done}
        >
          <div className="text-center mb-8">
            <div className="mb-5 flex justify-center">
              {failed ? (
                <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <X className="size-7 text-red-400" aria-hidden />
                </div>
              ) : done ? (
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <Check className="size-7 text-emerald-400" aria-hidden />
                </div>
              ) : (
                <div className="relative inline-flex">
                  <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-[#6D5DF6] animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="size-5 text-primary-soft" aria-hidden />
                  </div>
                </div>
              )}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">
              {failed ? "Analysis failed" : done ? "Analysis complete" : "Analysing your reviews"}
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              {failed
                ? status.message || "Something went wrong. You can go back and try again."
                : done
                  ? "Redirecting to your decision dashboard…"
                  : status.total > 0
                    ? `${status.processed.toLocaleString()} of ${status.total.toLocaleString()} reviews processed`
                    : "Preparing your analysis pipeline…"}
            </p>
          </div>

          {!failed && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progress</span>
                <span className="text-xs font-bold font-mono text-primary-soft">{status.progress}%</span>
              </div>
              <Progress value={status.progress} aria-label={`Analysis progress ${status.progress}%`} />
            </div>
          )}

          <div className="space-y-2">
            {STEPS.map((s) => {
              const isDone = s.step < status.step || done;
              const current = !done && !failed && s.step === status.step;
              const future = !done && s.step > status.step;
              const Icon = s.icon;

              return (
                <div
                  key={s.step}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
                    current
                      ? "bg-primary/10 border-primary/30"
                      : isDone
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "border-transparent"
                  } ${future ? "opacity-40" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isDone
                        ? "bg-emerald-500/15 text-emerald-400"
                        : current
                          ? "bg-primary/20 text-primary-soft"
                          : "bg-white/5 text-slate-500"
                    }`}
                  >
                    {isDone ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold leading-tight ${
                        isDone ? "text-emerald-400" : current ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </p>
                    {current && <p className="text-xs text-primary-soft mt-0.5">{s.desc}</p>}
                  </div>

                  {current && <Loader2 className="size-4 text-primary-soft animate-spin shrink-0" aria-hidden />}
                </div>
              );
            })}
          </div>

          {failed && (
            <button
              type="button"
              className="w-full mt-6 py-3 rounded-xl border border-white/15 bg-transparent text-slate-300 text-sm font-semibold hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
              onClick={() => window.history.back()}
            >
              Try again
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          Typically 2–4 minutes for about 1,000 reviews.
        </p>
      </div>
    </div>
  );
}
