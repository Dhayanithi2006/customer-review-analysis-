"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ── Engagement mode configs ──────────────────────────────────────────────────
const MODE_THEMES = {
  reward: {
    gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
    accent:   "amber",
    icon:     "🎁",
    ratingLabel: "How would you rate your experience?",
    textPlaceholder: "Tell us about your experience. What did you like? What could we improve?",
    namePrompt: "Your name (optional — required to receive points)",
    ctaLabel: "Submit & Claim Points",
    ctaClass: "bg-amber-500 hover:bg-amber-400 text-black",
  },
  improvement: {
    gradient: "from-cyan-500/8 via-blue-500/5 to-transparent",
    accent:   "cyan",
    icon:     "💬",
    ratingLabel: "How satisfied were you with our service?",
    textPlaceholder: "Please share your experience. All feedback is confidential and used solely to improve our services.",
    namePrompt: "Your name (optional)",
    ctaLabel: "Submit Feedback",
    ctaClass: "bg-cyan-600 hover:bg-cyan-500 text-white",
  },
  product: {
    gradient: "from-indigo-500/10 via-violet-500/5 to-transparent",
    accent:   "indigo",
    icon:     "🚀",
    ratingLabel: "How would you rate this? (optional)",
    textPlaceholder: "What's working? What's broken? What would you love to see next?",
    namePrompt: "Your name (optional)",
    ctaLabel: "Send Feedback",
    ctaClass: "bg-indigo-600 hover:bg-indigo-500 text-white",
  },
} as const;

type EngagementMode = keyof typeof MODE_THEMES;

const PRODUCT_TAGS = ["Bug", "Feature Request", "Performance", "UX", "Praise", "Other"];

interface FormConfig {
  business_id: string;
  business_name: string;
  industry: string;
  engagement_mode: EngagementMode;
  mode_headline: string;
  mode_subtext: string;
  mode_success_message: string;
  show_reward_promise: boolean;
  show_tag_selector: boolean;
  requires_rating: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const labels = ["", "Terrible", "Poor", "Okay", "Good", "Excellent"];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className={`text-4xl sm:text-5xl transition-all duration-100 ${
              star <= (hovered || value) ? "text-amber-400 scale-110" : "text-slate-700 hover:scale-105"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {(hovered || value) > 0 && (
        <p className="text-sm font-semibold text-amber-400 h-5">
          {labels[hovered || value]}
        </p>
      )}
    </div>
  );
}

export default function FeedbackFormPage() {
  const params     = useParams();
  const router     = useRouter();
  const businessId = params.business_id as string;

  const [config, setConfig]     = useState<FormConfig | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [text, setText]           = useState("");
  const [rating, setRating]       = useState(0);
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [charCount, setCharCount] = useState(0);

  const MIN_CHARS = 20;

  useEffect(() => {
    fetch(`${API}/feedback/${businessId}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setConfig(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || submitting) return;

    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS) return;
    if (config.requires_rating && rating === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/feedback/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          rating: rating || undefined,
          customer_name: name.trim() || undefined,
          customer_email: email.trim() || undefined,
          feedback_tag: selectedTag || undefined,
        }),
      });

      if (res.ok) {
        router.push(`/feedback/${businessId}/success?mode=${config.engagement_mode}&biz=${encodeURIComponent(config.business_name)}`);
      } else {
        throw new Error("Submission failed");
      }
    } catch {
      // show inline error
      alert("Sorry, something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Loading feedback form…</p>
      </div>
    </div>
  );

  if (notFound || !config) return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-5xl mb-4">😕</p>
        <h1 className="text-xl font-bold text-slate-100 mb-2">Form Not Found</h1>
        <p className="text-sm text-slate-400">This feedback link has expired or is invalid. Please ask the business for a new QR code.</p>
      </div>
    </div>
  );

  const mode  = config.engagement_mode;
  const theme = MODE_THEMES[mode] || MODE_THEMES.improvement;
  const isValid = text.trim().length >= MIN_CHARS && (!config.requires_rating || rating > 0);

  return (
    <div className={`min-h-screen bg-[#07080d] relative`}>
      {/* Ambient gradient */}
      <div className={`fixed inset-0 bg-gradient-to-br ${theme.gradient} pointer-events-none`} />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/6 border border-white/10 mb-4">
              <span className="text-sm">{theme.icon}</span>
              <span className="text-[11px] font-semibold text-slate-400">{config.business_name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mb-3 leading-tight">
              {config.mode_headline}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">{config.mode_subtext}</p>
          </div>

          {/* Form card */}
          <form onSubmit={handleSubmit} className="bg-[#0d0f1a]/90 border border-white/8 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">

            {/* Rating */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {theme.ratingLabel}
                {config.requires_rating && <span className="text-red-400 ml-1">*</span>}
              </label>
              <StarRatingInput value={rating} onChange={setRating} />
            </div>

            {/* PRODUCT: Tag selector */}
            {config.show_tag_selector && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Category (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        selectedTag === tag
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback text */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Your Feedback <span className="text-red-400">*</span>
                </label>
                <span className={`text-[10px] font-mono ${charCount >= MIN_CHARS ? "text-emerald-400" : "text-slate-600"}`}>
                  {charCount}/{MIN_CHARS} min
                </span>
              </div>
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setCharCount(e.target.value.trim().length); }}
                placeholder={theme.textPlaceholder}
                rows={5}
                required
                minLength={MIN_CHARS}
                maxLength={2000}
                className="w-full bg-[#161827] border border-white/8 rounded-2xl px-4 py-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Optional name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {theme.namePrompt}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={mode === "reward" ? "e.g. Priya S." : "e.g. Rahul"}
                maxLength={80}
                className="w-full bg-[#161827] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* REWARD: reward promise banner */}
            {config.show_reward_promise && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <span className="text-xl shrink-0">⭐</span>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  <strong>Earn loyalty points</strong> for submitting valid feedback. Points are credited to your account within 24 hours.
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || submitting}
              className={`w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${theme.ctaClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Submitting…</>
              ) : (
                <>{theme.icon} {theme.ctaLabel}</>
              )}
            </button>

            <p className="text-center text-[10px] text-slate-600 leading-relaxed">
              Your feedback is kept private and used only to improve {config.business_name}.
              {config.show_tag_selector && " Your input directly shapes our product roadmap."}
            </p>

          </form>

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-700 mt-6">
            Powered by <span className="text-slate-500 font-semibold">RoadmapAI</span> — Customer Intelligence Platform
          </p>
        </div>
      </div>
    </div>
  );
}
