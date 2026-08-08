"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// ── Engagement mode themes & copywriting ──────────────────────────────────────
const MODE_THEMES = {
  reward: {
    ratingLabel: "How was your experience?",
    textPlaceholder: "Tell us what we can improve...",
    namePrompt: "Your name (optional)",
    ctaLabel: "Submit feedback",
  },
  improvement: {
    ratingLabel: "How was your experience today?",
    textPlaceholder: "Tell us how we can serve you better.",
    namePrompt: "Your name (optional)",
    ctaLabel: "Submit feedback",
  },
  product: {
    ratingLabel: "How was your experience?",
    textPlaceholder: "What should we improve?",
    namePrompt: "Your name (optional)",
    ctaLabel: "Submit feedback",
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
      <div className="flex gap-2" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className={`text-3xl transition-colors ${
              star <= (hovered || value) ? "text-amber-400" : "text-slate-600"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {(hovered || value) > 0 && (
        <p className="text-xs text-slate-400 h-4">{labels[hovered || value]}</p>
      )}
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FeedbackFormContent() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const businessId   = params.business_id as string;
  const sourceParam  = (searchParams.get("source") || "").toLowerCase();
  const feedbackSource: "qr" | "direct" = sourceParam === "qr" ? "qr" : "direct";

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
    if (!trimmed) {
      setErrorMsg("Please enter your feedback.");
      return;
    }
    if (trimmed.length < minChars) {
      setErrorMsg(`Please enter at least ${minChars} characters.`);
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMsg("Please select a star rating (1–5).");
      return;
    }
    const emailTrimmed = email.trim();
    if (emailTrimmed && !EMAIL_RE.test(emailTrimmed)) {
      setErrorMsg("Please enter a valid email address, or leave it blank.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/feedback/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          rating,
          customer_name: name.trim() || undefined,
          customer_email: emailTrimmed || undefined,
          feedback_tag: selectedTag || undefined,
          user_token: userToken,
          source: feedbackSource,
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 animate-pulse space-y-4">
        <div className="h-6 w-2/3 bg-white/10 rounded mx-auto" />
        <div className="h-24 bg-white/5 rounded-xl" />
        <div className="h-11 bg-white/10 rounded-xl" />
      </div>
    </div>
  );

  if (notFound || !config) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-3">
        <h1 className="text-xl font-bold text-white">Feedback form unavailable</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          This link could not be loaded. Ask staff for an updated QR code or URL.
        </p>
      </div>
    </div>
  );

  const mode = config.engagement_mode;
  const theme = MODE_THEMES[mode] || MODE_THEMES.improvement;
  const isValid = text.trim().length >= minChars && rating >= 1 && rating <= 5;

  return (
    <div className="min-h-screen bg-background text-slate-100">
      <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
        <header className="text-center mb-6 space-y-2">
          <p className="text-xs font-semibold text-slate-400">{config.business_name}</p>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            {config.mode_headline}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {config.mode_subtext}
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5"
        >
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300"
            >
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 text-center">
              {theme.ratingLabel} <span className="text-amber-400">*</span>
            </label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          {config.show_tag_selector && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Category (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedTag === tag
                        ? "bg-primary/20 border-primary/40 text-white"
                        : "border-border text-slate-400"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Your feedback <span className="text-amber-400">*</span>
              </label>
              <span
                className={`text-[10px] font-mono ${
                  charCount >= minChars ? "text-emerald-400" : "text-slate-600"
                }`}
              >
                {charCount}/{minChars}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setCharCount(e.target.value.trim().length);
              }}
              placeholder={theme.textPlaceholder}
              rows={4}
              required
              minLength={minChars}
              maxLength={2000}
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              {theme.namePrompt}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              maxLength={80}
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary/40"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Email (optional)
            </label>
            <p className="text-[10px] text-slate-500 mb-2">
              Optional — only used to follow up on this feedback.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              maxLength={200}
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary/40"
            />
          </div>

          {config.show_reward_promise && config.reward_enabled && !inCooldown && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
              Earn {config.points_per_feedback} loyalty points
              {config.reward_description ? ` — ${config.reward_description}` : ""}
            </div>
          )}

          {inCooldown && (
            <p className="text-[11px] text-slate-500 text-center">
              Reward cooldown active. You can still submit feedback.
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full py-3.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : theme.ctaLabel}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          Powered by RoadmapAI for {config.business_name}
        </p>
      </div>
    </div>
  );
}

export default function FeedbackFormPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <FeedbackFormContent />
    </Suspense>
  );
}
