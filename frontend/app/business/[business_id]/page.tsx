"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getBusiness } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";

// ─── Constants ───────────────────────────────────────────────────────────────

const PHYSICAL_INDUSTRIES = new Set([
  "Hospital", "School", "Hostel", "Supermarket", "Restaurant", "Hotel", "Bank",
]);

const INDUSTRY_ICONS: Record<string, string> = {
  "Mobile App": "📱", "SaaS": "☁️", "E-commerce": "🛒",
  "Hospital": "🏥", "School": "🏫", "Hostel": "🏠",
  "Supermarket": "🛍️", "Restaurant": "🍽️", "Hotel": "🏨", "Bank": "🏦",
};

const COMING_SOON = [
  { icon: "🎧", name: "Zendesk",        desc: "Auto-import support tickets" },
  { icon: "🌟", name: "Freshdesk",      desc: "Helpdesk conversation analysis" },
  { icon: "⭐", name: "Google Reviews", desc: "Business review ingestion" },
  { icon: "💬", name: "Intercom",       desc: "Customer conversation analytics" },
];

// ─── Tailored onboarding sources based on feedback_method ───────────────────
function getOnboardingCTA(biz: BusinessResponse) {
  const m = biz.feedback_method;
  if (m === "none") {
    return {
      icon: "📲",
      title: "Start collecting feedback",
      desc: "You haven't collected feedback yet. The easiest way to start is with a QR code — customers scan and submit instantly.",
      primaryLabel: biz.feedback_type === "qr" ? "Open Feedback Form" : "Upload a CSV",
      primaryHref: biz.feedback_type === "qr" ? biz.feedback_url : "/",
      secondaryLabel: "Learn how",
      secondaryHref: "/",
    };
  }
  if (m === "app_store") {
    return {
      icon: "🤖",
      title: "Import your app reviews",
      desc: "You collect feedback from app stores. Connect your Play Store Package ID or App Store app to start analysing reviews.",
      primaryLabel: "Import from Google Play",
      primaryHref: "/",
      secondaryLabel: "Upload a CSV export",
      secondaryHref: "/",
    };
  }
  if (m === "csv") {
    return {
      icon: "📄",
      title: "Upload your existing feedback",
      desc: "You already have feedback in a CSV. Upload it now and get your first analysis in under 3 minutes.",
      primaryLabel: "Upload CSV",
      primaryHref: "/",
      secondaryLabel: "Import from Play Store",
      secondaryHref: "/",
    };
  }
  if (m === "qr") {
    return {
      icon: "📲",
      title: "Your feedback form is ready",
      desc: "Your QR code is active. Share it with customers and return here once you've collected responses.",
      primaryLabel: "View Feedback Form",
      primaryHref: biz.feedback_url,
      secondaryLabel: "Upload existing CSV",
      secondaryHref: "/",
    };
  }
  // email, google_reviews, default
  return {
    icon: "📊",
    title: "Import your feedback",
    desc: "Upload a CSV export of your customer feedback and RoadmapAI will analyse it for revenue-impacting issues.",
    primaryLabel: "Upload CSV",
    primaryHref: "/",
    secondaryLabel: "Connect Play Store",
    secondaryHref: "/",
  };
}

// ─── Reusable UI components ──────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/10 border border-white/8 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all shrink-0"
    >
      {copied ? "✓ Copied" : `📋 ${label || "Copy"}`}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#08090e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-7 h-7 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Loading workspace…</p>
      </div>
    </div>
  );
}

// ─── Main dashboard page ─────────────────────────────────────────────────────

export default function BusinessDashboardPage() {
  const params     = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz]         = useState<BusinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    getBusiness(businessId)
      .then(setBiz)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return <Skeleton />;

  if (error || !biz) {
    return (
      <div className="min-h-screen bg-[#08090e] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔍</p>
          <h1 className="text-lg font-bold text-slate-100 mb-2">Workspace not found</h1>
          <p className="text-sm text-slate-400 mb-6">{error || "This business ID doesn't exist."}</p>
          <Link href="/register" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
            Create New Workspace
          </Link>
        </div>
      </div>
    );
  }

  const isPhysical = PHYSICAL_INDUSTRIES.has(biz.industry);
  const onboarding = getOnboardingCTA(biz);

  return (
    <div className="min-h-screen bg-[#08090e] text-slate-100">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[10%] w-[600px] h-[600px] bg-indigo-600/4 rounded-full blur-[130px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#08090e]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-xl px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm">🗺️</div>
              <span className="font-black text-sm tracking-tight text-slate-100">RoadmapAI</span>
            </Link>
            <span className="text-slate-700 text-xs hidden sm:block">/</span>
            <span className="text-xs text-slate-400 hidden sm:block font-medium truncate max-w-[160px]">{biz.business_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              ⚙️ Settings
            </button>
            <Link href="/" className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
              Analyse Feedback
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-screen-xl px-6 py-10">

        {/* ── Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{INDUSTRY_ICONS[biz.industry] || "🏢"}</span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-100 leading-tight">
                {biz.business_name}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{biz.industry}</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Workspace Active
          </span>
        </div>

        {/* ── Settings Panel (collapsed by default) */}
        {showSettings && (
          <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-6 mb-6">
            <h2 className="text-sm font-bold text-slate-100 mb-4">⚙️ Workspace Settings</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {[
                { label: "Monthly Customers", value: biz.monthly_customers.toLocaleString(), icon: "👥" },
                { label: "Avg Revenue / Customer", value: `${biz.currency} ${biz.avg_revenue_per_user}`, icon: "💰" },
                { label: "Premium Customer %", value: `${biz.premium_pct}%`, icon: "⭐" },
                { label: "Currency", value: biz.currency, icon: "🌐" },
              ].map(s => (
                <div key={s.label} className="p-3.5 rounded-xl bg-[#0a0c14] border border-white/5">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{s.icon} {s.label}</p>
                  <p className="font-black font-mono text-slate-200">{s.value}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-4 italic">
              These settings power the Revenue Impact calculation in the Decision Engine.
              {" "}<Link href="/register" className="text-indigo-400 hover:underline">Update via re-registration →</Link>
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── LEFT: Workspace Info */}
          <div className="space-y-5">

            {/* Identity card */}
            <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Workspace Identity</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Business ID</p>
                  <p className="text-[11px] font-mono text-slate-400 break-all">{biz.id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Dashboard URL</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#161827] border border-white/5">
                    <p className="text-[10px] font-mono text-indigo-400 flex-1 truncate">{biz.dashboard_url}</p>
                    <CopyButton text={biz.dashboard_url} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Feedback URL</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#161827] border border-white/5">
                    <p className="text-[10px] font-mono text-cyan-400 flex-1 truncate">{biz.feedback_url}</p>
                    <CopyButton text={biz.feedback_url} />
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code (physical only) */}
            {isPhysical && (
              <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">QR Code</h2>
                  {biz.qr_code && (
                    <a
                      id="btn-download-qr"
                      href={biz.qr_code}
                      download={`${biz.business_name.replace(/\s+/g, "_")}_QR.png`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold transition-colors"
                    >
                      ⬇️ Download PNG
                    </a>
                  )}
                </div>
                {biz.qr_code ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-xl bg-white p-3 border border-white/10">
                      <Image src={biz.qr_code} alt="Feedback QR Code" width={160} height={160} />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                      Print and place at your location. Customers scan to submit feedback.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-6 rounded-xl border border-dashed border-white/8 text-slate-600 text-xs">
                    QR not available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Feedback Sources + Tailored Onboarding */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Tailored Empty State / Onboarding CTA */}
            <div className="rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/6 to-violet-500/3 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-2xl shrink-0">{onboarding.icon}</div>
                <div className="flex-1">
                  <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold mb-1">No Feedback Yet</p>
                  <h3 className="font-bold text-base text-slate-100 mb-2">{onboarding.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{onboarding.desc}</p>
                  <div className="flex gap-3 flex-wrap">
                    <a
                      id="btn-onboarding-primary"
                      href={onboarding.primaryHref}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                    >
                      {onboarding.primaryLabel} →
                    </a>
                    <a
                      id="btn-onboarding-secondary"
                      href={onboarding.secondaryHref}
                      className="px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold transition-colors"
                    >
                      {onboarding.secondaryLabel}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Feedback Sources */}
            <div>
              <h2 className="text-sm font-bold text-slate-100 mb-1">Choose Feedback Source</h2>
              <p className="text-xs text-slate-500 mb-4">
                {isPhysical
                  ? "Collect feedback via QR code or a feedback form at your location."
                  : "Import reviews from your digital platforms for AI analysis."}
              </p>

              {isPhysical ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <a
                    id="source-qr-feedback"
                    href={biz.feedback_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-2xl border border-white/8 bg-[#0d0f1a] hover:border-indigo-500/30 hover:bg-[#111422] transition-all p-5 no-underline"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-xl mb-4">📲</div>
                    <h3 className="font-bold text-sm text-slate-100 mb-1">Generate QR Feedback</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">Share a QR code at your location. Customers scan and submit structured feedback instantly.</p>
                    <span className="text-xs text-indigo-400 font-semibold group-hover:gap-2 flex items-center gap-1 transition-all">Open Feedback Form →</span>
                  </a>
                  <Link
                    id="source-view-feedback"
                    href={`/business/${businessId}/feedback`}
                    className="group rounded-2xl border border-white/8 bg-[#0d0f1a] hover:border-cyan-500/30 hover:bg-[#111422] transition-all p-5 no-underline"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-xl mb-4">📋</div>
                    <h3 className="font-bold text-sm text-slate-100 mb-1">View Feedback Form</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">Preview and configure the customer-facing form linked to your QR code.</p>
                    <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1">Configure Form →</span>
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    {
                      id: "source-csv", icon: "📄", title: "CSV Upload",
                      desc: "Upload any CSV export. Column names are auto-detected.",
                      color: "indigo", href: "/", badge: null,
                    },
                    {
                      id: "source-play-store", icon: "🤖", title: "Google Play Import",
                      desc: "Enter your Package ID to fetch live Play Store reviews.",
                      color: "emerald", href: "/", badge: null,
                    },
                    {
                      id: "source-app-store", icon: "🍎", title: "App Store Import",
                      desc: "Apple App Store review ingestion.", color: "slate", href: null, badge: "Soon",
                    },
                  ].map(src => (
                    src.href ? (
                      <Link
                        key={src.id}
                        id={src.id}
                        href={src.href}
                        className={`group rounded-2xl border border-white/8 bg-[#0d0f1a] hover:border-${src.color}-500/30 hover:bg-[#111422] transition-all p-5 no-underline`}
                      >
                        <div className={`w-10 h-10 rounded-xl bg-${src.color}-500/15 border border-${src.color}-500/25 flex items-center justify-center text-xl mb-4`}>{src.icon}</div>
                        <h3 className="font-bold text-sm text-slate-100 mb-1">{src.title}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">{src.desc}</p>
                        <span className={`text-xs text-${src.color}-400 font-semibold flex items-center gap-1`}>Import →</span>
                      </Link>
                    ) : (
                      <div key={src.id} id={src.id} className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5 relative overflow-hidden opacity-60">
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[9px] font-bold uppercase">{src.badge}</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-xl mb-4">{src.icon}</div>
                        <h3 className="font-bold text-sm text-slate-400 mb-1">{src.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{src.desc}</p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Coming Soon */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Coming Soon</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {COMING_SOON.map(src => (
                  <div key={src.name} className="rounded-xl border border-white/5 bg-[#0d0f1a] p-4 opacity-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{src.icon}</span>
                      <span className="text-xs font-bold text-slate-400">{src.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed">{src.desc}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/4 border border-white/6 text-[9px] font-bold uppercase text-slate-600">
                      Coming Soon
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
