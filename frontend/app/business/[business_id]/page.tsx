"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getBusiness } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";

const PHYSICAL_INDUSTRIES = new Set([
  "Hospital", "School", "Hostel", "Supermarket", "Restaurant", "Hotel", "Bank"
]);

const INDUSTRY_ICONS: Record<string, string> = {
  "Mobile App": "📱", "SaaS": "☁️", "E-commerce": "🛒",
  "Hospital": "🏥", "School": "🏫", "Hostel": "🏠",
  "Supermarket": "🛍️", "Restaurant": "🍽️", "Hotel": "🏨", "Bank": "🏦",
};

const COMING_SOON_SOURCES = [
  { icon: "🎧", name: "Zendesk", desc: "Auto-import support tickets" },
  { icon: "🌟", name: "Freshdesk", desc: "Helpdesk conversation analysis" },
  { icon: "⭐", name: "Google Reviews", desc: "Business review ingestion" },
  { icon: "💬", name: "Intercom", desc: "Customer conversation analytics" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/10 border border-white/8 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all shrink-0"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#08090e] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

export default function BusinessDashboardPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz]     = useState<BusinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="text-center">
          <p className="text-red-400 mb-4">⚠️ {error || "Business not found"}</p>
          <Link href="/register" className="text-indigo-400 hover:underline text-sm">
            Create a new workspace →
          </Link>
        </div>
      </div>
    );
  }

  const isPhysical = PHYSICAL_INDUSTRIES.has(biz.industry);

  return (
    <div className="min-h-screen bg-[#08090e] text-slate-100">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[130px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#08090e]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-xl px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm shadow-[0_0_14px_rgba(99,102,241,0.4)]">
              🗺️
            </div>
            <span className="font-black text-sm tracking-tight text-slate-100">RoadmapAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="px-3.5 py-1.5 rounded-lg border border-white/8 hover:border-white/15 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Analyse Feedback
            </Link>
            <Link href="/register" className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
              New Workspace
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-screen-xl px-6 py-10">

        {/* ── Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{INDUSTRY_ICONS[biz.industry] || "🏢"}</span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-100 leading-tight">
                {biz.business_name}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{biz.industry}</p>
            </div>
            <span className="ml-auto px-3 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Workspace Active
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN: Business Info Card */}
          <div className="lg:col-span-1 space-y-5">

            {/* Business Details */}
            <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Workspace Details</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Business ID</p>
                  <p className="text-xs font-mono text-slate-400 break-all">{biz.id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-xs text-slate-300">{biz.email}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Industry</p>
                  <p className="text-xs text-slate-300">{biz.industry}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Feedback URL</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#161827] border border-white/6">
                    <p className="text-[11px] font-mono text-indigo-400 flex-1 truncate">{biz.feedback_url}</p>
                    <CopyButton text={biz.feedback_url} />
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code — only for physical businesses */}
            {isPhysical && (
              <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">QR Code</h2>
                  {biz.qr_code && (
                    <a
                      id="btn-download-qr"
                      href={biz.qr_code}
                      download={`${biz.business_name.replace(/\s/g, "_")}_QR.png`}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                    >
                      ⬇️ Download
                    </a>
                  )}
                </div>
                {biz.qr_code ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-xl overflow-hidden border border-white/8 bg-white p-3">
                      <Image
                        src={biz.qr_code}
                        alt="Feedback QR Code"
                        width={180}
                        height={180}
                        className="block"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                      Print and place at your location. Customers scan to leave feedback.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 rounded-xl border border-dashed border-white/10 text-slate-600 text-sm">
                    QR code not available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Feedback Sources */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-100 mb-1">Choose Feedback Source</h2>
              <p className="text-xs text-slate-500">
                {isPhysical
                  ? "Collect feedback from your physical location using QR codes or a feedback form."
                  : "Import customer reviews from your digital platforms for AI analysis."}
              </p>
            </div>

            {/* Physical sources */}
            {isPhysical ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <a
                  id="source-qr-feedback"
                  href={biz.feedback_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-white/8 bg-[#0d0f1a] hover:border-indigo-500/30 hover:bg-[#111422] transition-all duration-150 p-5 no-underline"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-xl mb-4">
                    📲
                  </div>
                  <h3 className="font-bold text-sm text-slate-100 mb-1">Generate QR Feedback</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Share a QR code at your location. Customers scan and submit structured feedback instantly.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-indigo-400 text-xs font-semibold">
                    Open Feedback Form <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                  </div>
                </a>

                <Link
                  id="source-view-feedback"
                  href={`/business/${businessId}/feedback`}
                  className="group rounded-2xl border border-white/8 bg-[#0d0f1a] hover:border-cyan-500/30 hover:bg-[#111422] transition-all duration-150 p-5 no-underline"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-xl mb-4">
                    📋
                  </div>
                  <h3 className="font-bold text-sm text-slate-100 mb-1">View Feedback Form</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Preview and configure the customer-facing feedback form linked to your QR code.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-cyan-400 text-xs font-semibold">
                    Configure Form <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                  </div>
                </Link>
              </div>
            ) : (
              /* Digital sources */
              <div className="grid sm:grid-cols-3 gap-4">
                <Link
                  id="source-csv-upload"
                  href="/"
                  className="group rounded-2xl border border-white/8 bg-[#0d0f1a] hover:border-indigo-500/30 hover:bg-[#111422] transition-all duration-150 p-5 no-underline"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-xl mb-4">
                    📄
                  </div>
                  <h3 className="font-bold text-sm text-slate-100 mb-1">CSV Upload</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Upload any CSV export. Column names are auto-detected.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-indigo-400 text-xs font-semibold">
                    Upload CSV <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                  </div>
                </Link>

                <Link
                  id="source-play-store"
                  href="/"
                  className="group rounded-2xl border border-white/8 bg-[#0d0f1a] hover:border-emerald-500/30 hover:bg-[#111422] transition-all duration-150 p-5 no-underline"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl mb-4">
                    🤖
                  </div>
                  <h3 className="font-bold text-sm text-slate-100 mb-1">Google Play Import</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enter your Package ID to fetch live reviews directly from Play Store.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                    Import Reviews <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                  </div>
                </Link>

                <div
                  id="source-app-store"
                  className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5 relative overflow-hidden"
                >
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[9px] font-bold uppercase tracking-wide">Soon</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-white/8 flex items-center justify-center text-xl mb-4 opacity-60">
                    🍎
                  </div>
                  <h3 className="font-bold text-sm text-slate-400 mb-1">App Store Import</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Direct Apple App Store review ingestion. Coming soon.
                  </p>
                </div>
              </div>
            )}

            {/* Coming Soon section */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-white/6" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Coming Soon</span>
                <div className="h-px flex-1 bg-white/6" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {COMING_SOON_SOURCES.map(src => (
                  <div
                    key={src.name}
                    className="rounded-xl border border-white/5 bg-[#0d0f1a] p-4 opacity-50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{src.icon}</span>
                      <span className="text-xs font-bold text-slate-400">{src.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed">{src.desc}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/4 border border-white/6 text-[9px] font-bold uppercase text-slate-600 tracking-wide">
                      Coming Soon
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis CTA */}
            <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shrink-0">🧠</div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-slate-100 mb-1">Ready to analyse feedback?</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Once you collect feedback, RoadmapAI will automatically identify the issues costing your business the most — and tell you exactly what to fix first.
                  </p>
                  <Link href="/" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
                    🚀 Analyse Feedback Now
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
