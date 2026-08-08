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
        reward_enabled: rewardEnabled,
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

  if (!biz) {
    return (
      <WorkspacePage width="narrow">
        <EmptyState
          title="Workspace not found"
          description="This business workspace could not be loaded."
          action={{ label: "Go home", href: "/" }}
        />
      </WorkspacePage>
    );
  }

  const fieldClass =
    "w-full h-11 rounded-[16px] border border-white/[0.08] bg-surface-2 px-3 text-sm text-white outline-none transition-all focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(109,93,246,0.22)]";

  return (
    <WorkspacePage width="narrow">
      <PageIntro
        eyebrow="Settings"
        title="Workspace settings"
        description="Configure feedback engagement modes, reward rules, and revenue impact parameters."
      />

      {/* Business Identity */}
      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-5 card-elevated">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-4">
          Business identity
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Business name", value: biz.business_name },
            { label: "Industry", value: biz.industry },
            { label: "Email", value: biz.email },
            { label: "Feedback method", value: biz.feedback_method },
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

      {/* Feedback Engagement Settings Editor */}
      <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6 mb-5 card-elevated">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Feedback Engagement Settings
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">
            Default: {biz.industry}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Customize how feedback is collected from your customers. Industry defaults are pre-applied, but you can override any setting below.
        </p>

        <div className="space-y-5">
          {/* Mode Selector */}
          <div>
            <Label htmlFor="feedback-mode">Feedback Mode</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {[
                { value: "reward", icon: "🎁", label: "Reward Mode", desc: "Points & Incentives" },
                { value: "improvement", icon: "💬", label: "Improvement Mode", desc: "Trust & Quality" },
                { value: "product", icon: "🚀", label: "Product Mode", desc: "Roadmap & Features" },
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
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-white"
                        : "border-white/10 bg-surface-2 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <span className="text-xl block mb-1">{m.icon}</span>
                    <p className="text-xs font-bold text-slate-200">{m.label}</p>
                    <p className="text-[10px] text-slate-500">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Message */}
          <div>
            <Label htmlFor="feedback-message">Feedback Form Headline / Message</Label>
            <Input
              id="feedback-message"
              type="text"
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="e.g. Help us serve you better"
            />
          </div>

          {/* Core Configuration Parameters */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min-length">Minimum Feedback Length (chars)</Label>
              <Input
                id="min-length"
                type="number"
                value={minimumFeedbackLength}
                onChange={(e) => setMinimumFeedbackLength(e.target.value)}
                min={5}
                max={500}
              />
            </div>
            <div>
              <Label htmlFor="cooldown-hours">Cooldown Between Submissions (hours)</Label>
              <Input
                id="cooldown-hours"
                type="number"
                value={cooldownHours}
                onChange={(e) => setCooldownHours(e.target.value)}
                min={0}
                max={8760}
              />
            </div>
          </div>

          {/* Reward Settings Panel (Conditional or Togglable) */}
          <div className="pt-3 border-t border-white/8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="reward-toggle">Reward / Gamification Mechanics</Label>
                <p className="text-[11px] text-slate-500">Enable points and rewards for customer feedback</p>
              </div>
              <input
                id="reward-toggle"
                type="checkbox"
                checked={rewardEnabled}
                onChange={(e) => setRewardEnabled(e.target.checked)}
                className="w-5 h-5 accent-primary rounded cursor-pointer"
              />
            </div>

            {rewardEnabled && (
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="points-per-feedback">Points Per Feedback</Label>
                    <Input
                      id="points-per-feedback"
                      type="number"
                      value={pointsPerFeedback}
                      onChange={(e) => setPointsPerFeedback(e.target.value)}
                      min={1}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reward-threshold">Reward Threshold (Points)</Label>
                    <Input
                      id="reward-threshold"
                      type="number"
                      value={rewardThreshold}
                      onChange={(e) => setRewardThreshold(e.target.value)}
                      min={1}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reward-description">Reward Description</Label>
                  <Input
                    id="reward-description"
                    type="text"
                    value={rewardDescription}
                    onChange={(e) => setRewardDescription(e.target.value)}
                    placeholder="e.g. Free coffee on your next visit"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSaveFeedbackSettings}
              disabled={savingFeedbackSettings}
            >
              {savingFeedbackSettings ? "Saving Settings..." : feedbackSettingsSaved ? "Saved ✓" : "Save Engagement Settings"}
            </Button>
          </div>
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
            { label: "Dashboard URL", value: biz.dashboard_url },
            { label: "Feedback URL", value: biz.feedback_url },
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
