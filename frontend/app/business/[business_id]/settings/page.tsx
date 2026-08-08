"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getBusiness,
  updateWorkspaceSettings,
  getFeedbackSettings,
  updateFeedbackSettings,
} from "@/lib/business-api";
import type { BusinessResponse, FeedbackEngagementSettings } from "@/lib/business-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz] = useState<BusinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Revenue settings state
  const [monthlyCustomers, setMonthlyCustomers] = useState("500");
  const [avgRevenue, setAvgRevenue] = useState("500");
  const [premiumPct, setPremiumPct] = useState("20");
  const [currency, setCurrency] = useState("INR");

  // Feedback Engagement Settings state
  const [feedbackSettings, setFeedbackSettings] = useState<FeedbackEngagementSettings | null>(null);
  const [savingFeedbackSettings, setSavingFeedbackSettings] = useState(false);
  const [feedbackSettingsSaved, setFeedbackSettingsSaved] = useState(false);

  const [feedbackMode, setFeedbackMode] = useState<"reward" | "improvement" | "product">("product");
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [pointsPerFeedback, setPointsPerFeedback] = useState("10");
  const [cooldownHours, setCooldownHours] = useState("168");
  const [minimumFeedbackLength, setMinimumFeedbackLength] = useState("10");
  const [rewardThreshold, setRewardThreshold] = useState("100");
  const [rewardDescription, setRewardDescription] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    Promise.all([
      getBusiness(businessId),
      getFeedbackSettings(businessId).catch(() => null),
    ])
      .then(([b, fs]) => {
        setBiz(b);
        setMonthlyCustomers(String(b.monthly_customers));
        setAvgRevenue(String(b.avg_revenue_per_user));
        setPremiumPct(String(b.premium_pct));
        setCurrency(b.currency);

        if (fs) {
          setFeedbackSettings(fs);
          setFeedbackMode(fs.feedback_mode);
          setRewardEnabled(fs.reward_enabled);
          setPointsPerFeedback(String(fs.points_per_feedback));
          setCooldownHours(String(fs.cooldown_hours));
          setMinimumFeedbackLength(String(fs.minimum_feedback_length));
          setRewardThreshold(String(fs.reward_threshold));
          setRewardDescription(fs.reward_description || "");
          setFeedbackMessage(fs.feedback_message || "");
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [businessId]);

  const handleSaveRevenue = async () => {
    setSaving(true);
    try {
      const updated = await updateWorkspaceSettings(businessId, {
        monthly_customers: parseInt(monthlyCustomers) || 500,
        avg_revenue_per_user: parseFloat(avgRevenue) || 500,
        premium_pct: parseFloat(premiumPct) || 20,
        currency,
      });
      setBiz(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      /* toast handled by api */
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeedbackSettings = async () => {
    setSavingFeedbackSettings(true);
    try {
      const updated = await updateFeedbackSettings(businessId, {
        feedback_mode: feedbackMode,
        reward_enabled: feedbackMode === "reward" ? true : rewardEnabled,
        points_per_feedback: parseInt(pointsPerFeedback) || 10,
        cooldown_hours: parseInt(cooldownHours) || 0,
        minimum_feedback_length: parseInt(minimumFeedbackLength) || 10,
        reward_threshold: parseInt(rewardThreshold) || 100,
        reward_description: rewardDescription,
        feedback_message: feedbackMessage,
      });
      setFeedbackSettings(updated);
      setFeedbackSettingsSaved(true);
      setTimeout(() => setFeedbackSettingsSaved(false), 3000);
    } catch {
      /* toast handled by api */
    } finally {
      setSavingFeedbackSettings(false);
    }
  };

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <WorkspacePage width="narrow">
        <ContentSkeleton variant="form" />
      </WorkspacePage>
    );
  }

  const safeBiz = biz || {
    id: businessId || "freshmart",
    business_name: "FreshMart Supermarket Pro",
    industry: "Supermarket",
    email: "feedback@freshmart.com",
    feedback_url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/feedback/${businessId || "freshmart"}`,
    dashboard_url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/business/${businessId || "freshmart"}`,
    qr_code: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23ffffff'/><rect x='20' y='20' width='60' height='60' fill='%231e1b4b'/><rect x='30' y='30' width='40' height='40' fill='%23ffffff'/><rect x='40' y='40' width='20' height='20' fill='%231e1b4b'/><rect x='120' y='20' width='60' height='60' fill='%231e1b4b'/><rect x='130' y='30' width='40' height='40' fill='%23ffffff'/><rect x='140' y='40' width='20' height='20' fill='%231e1b4b'/><rect x='20' y='120' width='60' height='60' fill='%231e1b4b'/><rect x='30' y='130' width='40' height='40' fill='%23ffffff'/><rect x='40' y='140' width='20' height='20' fill='%231e1b4b'/><rect x='100' y='40' width='10' height='20' fill='%231e1b4b'/><rect x='90' y='90' width='20' height='20' fill='%231e1b4b'/><rect x='120' y='100' width='30' height='20' fill='%231e1b4b'/><rect x='120' y='140' width='60' height='40' fill='%231e1b4b'/><rect x='140' y='150' width='20' height='20' fill='%23ffffff'/></svg>",
    feedback_type: "qr" as const,
    feedback_method: "qr",
    engagement_mode: "reward" as const,
    monthly_customers: 20000,
    avg_revenue_per_user: 450,
    premium_pct: 18,
    currency: "INR",
    created_at: new Date().toISOString(),
  };

  const currentBiz = biz || safeBiz;

  const fieldClass =
    "w-full h-11 rounded-[16px] border border-white/[0.08] bg-surface-2 px-3 text-sm text-white outline-none transition-all focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(109,93,246,0.22)]";

  // Dynamic preview computation
  const previewHeadline = feedbackMessage.trim() || (
    feedbackMode === "reward"
      ? `How was your experience at ${currentBiz.business_name}?`
      : feedbackMode === "improvement"
      ? "How was your experience today?"
      : "How was your experience?"
  );

  return (
    <WorkspacePage width="narrow">
      <PageIntro
        eyebrow="Settings"
        title="Workspace settings"
        description="Configure your customer feedback experience, reward parameters, and revenue impact defaults."
      />

      {/* Business Identity */}
      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-5 card-elevated">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-4">
          Business identity
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Business name", value: currentBiz.business_name },
            { label: "Industry", value: currentBiz.industry },
            { label: "Email", value: currentBiz.email },
            { label: "Feedback method", value: currentBiz.feedback_method },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1 font-semibold">
                {f.label}
              </p>
              <p className="text-sm text-slate-200 font-semibold">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PHASE 6: CUSTOMER FEEDBACK EXPERIENCE CONFIGURATION */}
      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-5 card-elevated">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Customer Feedback Experience
          </h2>
          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-semibold">
            Configured Mode: {feedbackMode.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Select how feedback is presented to your customers. Choose the experience mode that best fits your business model.
        </p>

        {/* 1. Mode Selector */}
        <div className="space-y-4 mb-6">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Feedback Mode</Label>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                value: "reward",
                icon: "🎁",
                title: "Reward Mode",
                subtitle: "Points & Incentives",
                desc: "Customers earn loyalty points for submitting valid feedback. Best for transactional businesses (supermarkets, restaurants, hotels).",
              },
              {
                value: "improvement",
                icon: "💬",
                title: "Improvement Mode",
                subtitle: "Trust & Service Quality",
                desc: "Feedback is framed as helping improve service quality. Professional, confidential, and institutional — no gamification.",
              },
              {
                value: "product",
                icon: "🚀",
                title: "Product Mode",
                subtitle: "Roadmap & Features",
                desc: "Feedback directly influences your product roadmap. Ideal for SaaS and mobile apps, with category tags.",
              },
            ].map((m) => {
              const active = feedbackMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setFeedbackMode(m.value as any);
                    if (m.value === "reward") setRewardEnabled(true);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    active
                      ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                      : "border-white/8 bg-surface-2 hover:border-white/20 text-slate-400"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{m.icon}</span>
                      {active && (
                        <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-100 mb-0.5">{m.title}</p>
                    <p className="text-[10px] text-indigo-300 font-semibold mb-2">{m.subtitle}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{m.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Dynamic Configuration Fields per Mode */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-2 border border-white/8 space-y-4 mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {feedbackMode === "reward" ? "🎁 Reward Mode Settings" : feedbackMode === "improvement" ? "💬 Improvement Mode Settings" : "🚀 Product Mode Settings"}
          </h3>

          {feedbackMode === "reward" && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="points-per-feedback">Points per valid feedback</Label>
                  <Input
                    id="points-per-feedback"
                    type="number"
                    value={pointsPerFeedback}
                    onChange={(e) => setPointsPerFeedback(e.target.value)}
                    min={1}
                    max={10000}
                    placeholder="10"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Points credited to customer upon valid submission</p>
                </div>
                <div>
                  <Label htmlFor="cooldown-hours">Reward cooldown</Label>
                  <div className="flex flex-wrap gap-2 mt-1.5 mb-2">
                    {[
                      { label: "24h", hours: "24" },
                      { label: "7d", hours: "168" },
                      { label: "30d", hours: "720" },
                      { label: "90d", hours: "2160" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setCooldownHours(preset.hours)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                          cooldownHours === preset.hours
                            ? "border-primary/50 bg-primary/15 text-primary-soft"
                            : "border-white/10 text-slate-400 hover:border-white/20"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    id="cooldown-hours"
                    type="number"
                    value={cooldownHours}
                    onChange={(e) => setCooldownHours(e.target.value)}
                    min={0}
                    max={8760}
                    placeholder="168"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Preset or custom hours. Cooldown uses hashed email/phone when provided, otherwise device token — not IP alone.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min-length">Minimum feedback length (characters)</Label>
                  <Input
                    id="min-length"
                    type="number"
                    value={minimumFeedbackLength}
                    onChange={(e) => setMinimumFeedbackLength(e.target.value)}
                    min={5}
                    max={500}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label htmlFor="reward-description">Reward description</Label>
                  <Input
                    id="reward-description"
                    type="text"
                    value={rewardDescription}
                    onChange={(e) => setRewardDescription(e.target.value)}
                    placeholder="e.g. Redeem points for discounts on your next visit"
                  />
                </div>
              </div>
            </>
          )}

          {feedbackMode === "improvement" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="feedback-message-imp">Feedback Headline / Question</Label>
                <Input
                  id="feedback-message-imp"
                  type="text"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="e.g. How was your experience today?"
                />
                <p className="text-[10px] text-slate-500 mt-1">Main heading shown to patients or institutional visitors</p>
              </div>
              <div>
                <Label htmlFor="min-length-imp">Minimum feedback length (characters)</Label>
                <Input
                  id="min-length-imp"
                  type="number"
                  value={minimumFeedbackLength}
                  onChange={(e) => setMinimumFeedbackLength(e.target.value)}
                  min={5}
                  max={500}
                  placeholder="20"
                />
              </div>
            </div>
          )}

          {feedbackMode === "product" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="feedback-message-prod">Feedback Headline / Question</Label>
                <Input
                  id="feedback-message-prod"
                  type="text"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="e.g. How was your experience? / What should we improve?"
                />
                <p className="text-[10px] text-slate-500 mt-1">Main heading shown to app or SaaS users</p>
              </div>
              <div>
                <Label htmlFor="min-length-prod">Minimum feedback length (characters)</Label>
                <Input
                  id="min-length-prod"
                  type="number"
                  value={minimumFeedbackLength}
                  onChange={(e) => setMinimumFeedbackLength(e.target.value)}
                  min={5}
                  max={500}
                  placeholder="15"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Live Customer Preview Card ("See what your customers will see") */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>📱</span> See what your customers will see
            </Label>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono font-semibold">
              Live Preview
            </span>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-[#07080d] border border-white/10 shadow-2xl relative overflow-hidden">
            {/* Ambient glow */}
            <div className={`absolute inset-0 bg-gradient-to-br opacity-20 pointer-events-none ${
              feedbackMode === "reward" ? "from-amber-500/20 to-transparent" :
              feedbackMode === "improvement" ? "from-cyan-500/20 to-transparent" :
              "from-indigo-500/20 to-transparent"
            }`} />

            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/6 border border-white/10">
                <span className="text-xs">
                  {feedbackMode === "reward" ? "🎁" : feedbackMode === "improvement" ? "💬" : "🚀"}
                </span>
                <span className="text-[11px] font-bold text-slate-200">{currentBiz.business_name}</span>
              </div>

              <h4 className="text-base sm:text-lg font-black text-slate-100 leading-tight">
                {previewHeadline}
              </h4>

              <p className="text-xs text-slate-400">
                {feedbackMode === "reward"
                  ? "Tell us what we can improve. Submit valid feedback to earn loyalty points."
                  : feedbackMode === "improvement"
                  ? "Tell us what we can improve. Your feedback is confidential and helps us improve service quality."
                  : "What should we improve? Your feedback directly shapes future product improvements."}
              </p>

              {/* Star Rating Simulation */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className="text-xl text-amber-400">★</span>
                ))}
              </div>

              {/* Product Mode Tags Preview */}
              {feedbackMode === "product" && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["Bug", "Feature Request", "Performance", "UX"].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-600/30 border border-indigo-500/40 text-indigo-200">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Reward Promise Preview */}
              {feedbackMode === "reward" && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-xl">🎁</span>
                  <div className="text-[11px] text-amber-300">
                    <p className="font-bold">Earn {pointsPerFeedback || 10} loyalty points</p>
                    <p className="text-amber-400/80 text-[10px]">
                      {rewardDescription || "Redeem points for discounts or special rewards on your next visit."}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit CTA Button Simulation */}
              <div className="pt-2">
                <div className={`w-full py-3 rounded-xl text-xs font-bold text-center ${
                  feedbackMode === "reward"
                    ? "bg-amber-500 text-black"
                    : feedbackMode === "improvement"
                    ? "bg-cyan-600 text-white"
                    : "bg-indigo-600 text-white"
                }`}>
                  {feedbackMode === "reward" ? "🎁 Submit & Claim Points" : "Submit Feedback"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={handleSaveFeedbackSettings}
            disabled={savingFeedbackSettings}
          >
            {savingFeedbackSettings ? "Saving Settings..." : feedbackSettingsSaved ? "Saved ✓" : "Save Feedback Experience Settings"}
          </Button>
        </div>
      </section>

      {/* Revenue Settings */}
      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-5 card-elevated">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1">
          Revenue settings
        </h2>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Used to estimate revenue at risk. Premium customers receive 1.5× weight in priority scoring.
        </p>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthly-customers">Monthly customers</Label>
              <Input
                id="monthly-customers"
                type="number"
                value={monthlyCustomers}
                onChange={(e) => setMonthlyCustomers(e.target.value)}
                min={1}
              />
            </div>
            <div>
              <Label htmlFor="avg-revenue">Avg revenue per customer</Label>
              <div className="flex gap-2">
                <select
                  id="currency"
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={`${fieldClass} w-[88px] shrink-0`}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Input
                  id="avg-revenue"
                  type="number"
                  value={avgRevenue}
                  onChange={(e) => setAvgRevenue(e.target.value)}
                  min={0}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="premium-pct">
              Premium / paying customers — {premiumPct}%
            </Label>
            <input
              id="premium-pct"
              type="range"
              value={premiumPct}
              onChange={(e) => setPremiumPct(e.target.value)}
              min={0}
              max={100}
              step={5}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>0% free</span>
              <span>50%</span>
              <span>100% paying</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSaveRevenue}
              disabled={saving}
            >
              {saving ? "Saving Revenue Settings..." : saved ? "Saved ✓" : "Save Revenue Settings"}
            </Button>
          </div>
        </div>
      </section>

      {/* Workspace URLs */}
      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-6 card-elevated">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-4">
          Workspace URLs
        </h2>
        <div className="space-y-3">
          {[
            { label: "Dashboard URL", value: currentBiz.dashboard_url },
            { label: "Feedback URL", value: currentBiz.feedback_url },
            { label: "Public Updates (You Said → We Did)", value: `${currentBiz.feedback_url}/updates` },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5 font-semibold">
                {f.label}
              </p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-white/[0.05]">
                <p className="text-[11px] font-mono text-primary-soft flex-1 truncate">
                  {f.value}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyValue(f.label, f.value)}
                >
                  {copied === f.label ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </WorkspacePage>
  );
}
