"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getFollowupContext, submitFollowupResponse } from "@/lib/api";

type ResponseOption = "improved" | "somewhat_improved" | "not_improved";

export default function PublicFollowUpPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  const [selectedResponse, setSelectedResponse] = useState<ResponseOption | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    getFollowupContext(token)
      .then((ctx) => {
        if (ctx.already_submitted) {
          setAlreadySubmitted(true);
        } else {
          setBusinessName(ctx.business_name || "Business");
          setIssueTitle(ctx.issue_title || "Your recent feedback");
          setActionTaken(ctx.action_taken || "Actions taken to resolve this issue");
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || "Invalid or expired follow-up link.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResponse || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await submitFollowupResponse(token, selectedResponse, comment.trim());
      if (res.success) {
        setSubmittedSuccess(true);
      } else {
        setErrorMsg("Failed to record response. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0d0f1a] border border-white/8 rounded-3xl p-8 space-y-6 text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-indigo-500/20 mx-auto" />
          <div className="h-6 w-3/4 bg-white/10 rounded-lg mx-auto" />
          <div className="h-20 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (alreadySubmitted || submittedSuccess) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-md bg-[#0d0f1a] border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>
          <h1 className="text-xl font-bold text-slate-100">Thank You!</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Thank you. Your feedback helps us measure whether the improvement worked.
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg && !businessName) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-md bg-[#0d0f1a] border border-red-500/30 rounded-3xl p-8 text-center space-y-4">
          <p className="text-4xl">⚠️</p>
          <h1 className="text-lg font-bold text-slate-100">Link Unavailable</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 relative flex items-center justify-center p-4 sm:p-6">
      {/* Background ambient glow */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none" />

      <div className="w-full max-w-lg z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/6 border border-white/10 text-xs font-semibold text-indigo-300">
            <span>✨</span> {businessName} Follow-Up
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            We listened to your feedback.
          </h1>
        </div>

        {/* Card Container */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#0d0f1a]/95 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6"
        >
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Reported issue summary */}
          <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              You previously reported:
            </p>
            <p className="text-sm font-medium text-slate-200 italic">
              "{issueTitle}"
            </p>
          </div>

          {/* Business action taken */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
              We took action:
            </p>
            <p className="text-sm font-semibold text-slate-100">
              "{actionTaken}"
            </p>
          </div>

          {/* Survey Question */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300 text-center uppercase tracking-wider">
              Has your experience improved?
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedResponse("improved")}
                className={`py-3.5 px-4 rounded-2xl text-xs font-bold transition-all border flex items-center justify-between ${
                  selectedResponse === "improved"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/10"
                    : "bg-[#161827] border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                }`}
              >
                <span>YES, MUCH BETTER</span>
                <span className="text-emerald-400 text-base">🟢</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedResponse("somewhat_improved")}
                className={`py-3.5 px-4 rounded-2xl text-xs font-bold transition-all border flex items-center justify-between ${
                  selectedResponse === "somewhat_improved"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10"
                    : "bg-[#161827] border-white/10 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                }`}
              >
                <span>SOMEWHAT BETTER</span>
                <span className="text-amber-400 text-base">🟡</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedResponse("not_improved")}
                className={`py-3.5 px-4 rounded-2xl text-xs font-bold transition-all border flex items-center justify-between ${
                  selectedResponse === "not_improved"
                    ? "bg-red-500/20 border-red-500 text-red-300 shadow-lg shadow-red-500/10"
                    : "bg-[#161827] border-white/10 text-slate-300 hover:border-red-500/40 hover:text-red-300"
                }`}
              >
                <span>NO, STILL AN ISSUE</span>
                <span className="text-red-400 text-base">🔴</span>
              </button>
            </div>
          </div>

          {/* Optional comment */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tell us more (optional):
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share additional details..."
              rows={3}
              maxLength={1000}
              className="w-full bg-[#161827] border border-white/10 rounded-2xl p-3.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!selectedResponse || submitting}
            className="w-full py-4 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? "Submitting..." : "Submit Response"}
          </button>
        </form>
      </div>
    </div>
  );
}
