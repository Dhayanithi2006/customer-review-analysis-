"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ── Engagement mode themes & copywriting ──────────────────────────────────────
const MODE_THEMES = {
  reward: {
    gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
    accent:   "amber",
    icon:     "🎁",
    ratingLabel: "How was your experience?",
    textPlaceholder: "Tell us what we can improve...",
    namePrompt: "Your name (optional)",
    ctaLabel: "Submit Feedback & Earn Points",
    ctaClass: "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20",
  },
  improvement: {
    gradient: "from-cyan-500/8 via-blue-500/5 to-transparent",
    accent:   "cyan",
    icon:     "💬",
    ratingLabel: "How was your experience today?",
    textPlaceholder: "Tell us how we can serve you better. All feedback is confidential.",
    namePrompt: "Your name (optional)",
    ctaLabel: "Submit Feedback",
    ctaClass: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20",
  },
  product: {
    gradient: "from-indigo-500/10 via-violet-500/5 to-transparent",
    accent:   "indigo",
    icon:     "🚀",
    ratingLabel: "How was your experience?",
    textPlaceholder: "What should we improve? What feature would you like to see next?",
    namePrompt: "Your name (optional)",
    ctaLabel: "Submit Product Feedback",
    ctaClass: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20",
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
  minimum_feedback_length: number;
  points_per_feedback: number;
  reward_enabled: boolean;
  reward_description: string;
  reward_threshold: number;
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
            className={`text-4xl sm:text-5xl transition-all duration-150 ${
              star <= (hovered || value) ? "text-amber-400 scale-110" : "text-slate-700 hover:scale-105"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {(hovered || value) > 0 && (
        <p className="text-xs font-bold text-amber-400 h-4 tracking-wide">
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

  const [config, setConfig]         = useState<FormConfig | null>(null);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  // Form inputs
  const [text, setText]           = useState("");
  const [rating, setRating]       = useState(0);
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [charCount, setCharCount] = useState(0);

  const [userToken, setUserToken]   = useState<string>("");
  const [inCooldown, setInCooldown] = useState(false);

  useEffect(() => {
    // Generate or retrieve anonymous user_token from localStorage
    let token = "";
    try {
      token = localStorage.getItem("roadmapai_user_token") || "";
      if (!token) {
        token = "usr-anon-" + crypto.randomUUID();
        localStorage.setItem("roadmapai_user_token", token);
      }
    } catch {
      token = "usr-anon-" + Math.random().toString(36).substring(2, 15);
    }
    setUserToken(token);

    // Fetch public form config
    fetch(`${API}/feedback/${businessId}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => {
        if (data) {
          setConfig(data);
          // Check reward eligibility / cooldown status if in reward mode
          if (data.engagement_mode === "reward" && token) {
            fetch(`${API}/${businessId}/reward/eligibility`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_token: token })
            })
              .then(res => res.json())
              .then(el => {
                if (el && el.reason === "cooldown_active") {
                  setInCooldown(true);
                }
              })
              .catch(() => null);
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [businessId]);

  const minChars = config?.minimum_feedback_length || 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || submitting) return;

    setErrorMsg(null);
    const trimmed = text.trim();
    if (trimmed.length < minChars) {
      setErrorMsg(`Please enter at least ${minChars} characters.`);
      return;
    }
    if (config.requires_rating && rating === 0) {
      setErrorMsg("Please select a star rating.");
      return;
    }

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
          user_token: userToken,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        const queryParams = new URLSearchParams({
          mode: config.engagement_mode,
          biz: config.business_name,
          msg: resData.message || config.mode_success_message,
          pts: String(resData.points_earned || 0),
          bal: String(resData.current_balance || 0),
          eligible: String(resData.reward_eligible ?? true),
        });
        if (resData.next_reward_at) {
          queryParams.set("next", resData.next_reward_at);
        }
        router.push(`/feedback/${businessId}/success?${queryParams.toString()}`);
      } else {
        setErrorMsg(resData.detail || "Submission failed. Please try again.");
      }
    } catch {
      setErrorMsg("Connection error. Please check your internet connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0f1a] border border-white/8 rounded-3xl p-8 space-y-6 text-center animate-pulse">
        <div className="w-12 h-12 rounded-full bg-white/10 mx-auto" />
        <div className="h-6 w-3/4 bg-white/10 rounded-lg mx-auto" />
        <div className="h-4 w-1/2 bg-white/5 rounded mx-auto" />
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="h-12 bg-white/10 rounded-2xl" />
      </div>
    </div>
  );

  if (notFound || !config) return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-5xl">📱</p>
        <h1 className="text-xl font-bold text-slate-100">Feedback Form Unavailable</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          This feedback QR link could not be loaded. Please ask the staff for an updated QR code or link.
        </p>
      </div>
    </div>
  );

  const mode  = config.engagement_mode;
  const theme = MODE_THEMES[mode] || MODE_THEMES.improvement;
  const isValid = text.trim().length >= minChars && (!config.requires_rating || rating > 0);

  return (
    <div className="min-h-screen bg-[#07080d] relative text-slate-100 select-none">
      {/* Ambient background gradient */}
      <div className={`fixed inset-0 bg-gradient-to-br ${theme.gradient} pointer-events-none`} />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8 sm:py-12">
        <div className="w-full max-w-md sm:max-w-lg">

          {/* Business Brand Header (Understandable in 3 Seconds) */}
          <div className="text-center mb-6 sm:mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/6 border border-white/10 shadow-sm">
              <span className="text-sm">{theme.icon}</span>
              <span className="text-xs font-bold text-slate-200">{config.business_name}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-100">
              {config.mode_headline}
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              {config.mode_subtext}
            </p>
          </div>

          {/* Form Container */}
          <form onSubmit={handleSubmit} className="bg-[#0d0f1a]/95 border border-white/10 rounded-3xl p-5 sm:p-8 backdrop-blur-xl shadow-2xl space-y-5 sm:space-y-6">

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 font-semibold flex items-center justify-between">
                <span>{errorMsg}</span>
                <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">✕</button>
              </div>
            )}

            {/* Star Rating Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
                {theme.ratingLabel}
                {config.requires_rating && <span className="text-amber-400 ml-1">*</span>}
              </label>
              <StarRatingInput value={rating} onChange={setRating} />
            </div>

            {/* PRODUCT MODE: Optional Tag Selector */}
            {config.show_tag_selector && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
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
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                          : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Feedback Textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tell us what we can improve <span className="text-amber-400">*</span>
                </label>
                <span className={`text-[10px] font-mono font-semibold ${charCount >= minChars ? "text-emerald-400" : "text-slate-500"}`}>
                  {charCount}/{minChars} min
                </span>
              </div>
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setCharCount(e.target.value.trim().length); }}
                placeholder={theme.textPlaceholder}
                rows={4}
                required
                minLength={minChars}
                maxLength={2000}
                className="w-full bg-[#161827] border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Optional Customer Name Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {theme.namePrompt}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Rahul"
                maxLength={80}
                className="w-full bg-[#161827] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* Optional Customer Email Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Email (optional)
              </label>
              <p className="text-[10px] text-slate-500 mb-2">
                Optional — only used to follow up on this feedback.
              </p>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                maxLength={200}
                className="w-full bg-[#161827] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* REWARD MODE Banner (Secondary to feedback request) */}
            {config.show_reward_promise && config.reward_enabled && !inCooldown && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-2xl shrink-0">🎁</span>
                <div className="text-[11px] text-amber-300 leading-relaxed">
                  <p className="font-bold">Earn {config.points_per_feedback} loyalty points</p>
                  <p className="text-amber-400/80">
                    {config.reward_description || "Redeem points for discounts or special rewards on your next visit."}
                  </p>
                </div>
              </div>
            )}

            {/* REWARD MODE Cooldown Notice */}
            {inCooldown && (
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 <strong>Reward cooldown active.</strong> You can still share your feedback anytime to help us improve!
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isValid || submitting}
              className={`w-full py-3.5 sm:py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${theme.ctaClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Submitting Feedback…</>
              ) : (
                <>{theme.icon} {theme.ctaLabel}</>
              )}
            </button>

            <p className="text-center text-[10px] text-slate-500 leading-relaxed">
              Your feedback goes directly to {config.business_name}. No spam. Confidential & secure.
            </p>

          </form>

          {/* Simple Clean Footer */}
          <p className="text-center text-[10px] text-slate-600 mt-6">
            Powered by <span className="text-slate-400 font-semibold">{config.business_name}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
