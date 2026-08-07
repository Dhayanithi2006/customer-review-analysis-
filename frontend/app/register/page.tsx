"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerBusiness } from "@/lib/business-api";

const INDUSTRIES = [
  { value: "Mobile App",    icon: "📱", group: "digital" },
  { value: "SaaS",          icon: "☁️",  group: "digital" },
  { value: "E-commerce",    icon: "🛒", group: "digital" },
  { value: "Hospital",      icon: "🏥", group: "physical" },
  { value: "School",        icon: "🏫", group: "physical" },
  { value: "Hostel",        icon: "🏠", group: "physical" },
  { value: "Supermarket",   icon: "🛍️", group: "physical" },
  { value: "Restaurant",    icon: "🍽️", group: "physical" },
  { value: "Hotel",         icon: "🏨", group: "physical" },
  { value: "Bank",          icon: "🏦", group: "physical" },
];

export default function RegisterPage() {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry]         = useState("");
  const [email, setEmail]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const selected = INDUSTRIES.find(i => i.value === industry);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !industry || !email.trim()) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const biz = await registerBusiness({
        business_name: businessName.trim(),
        industry,
        email: email.trim(),
      });
      router.push(`/business/${biz.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090e] text-slate-100 flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[15%] w-[700px] h-[700px] bg-indigo-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-500/4 rounded-full blur-[110px]" />
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
          <span className="text-xs text-slate-500">Customer Feedback Intelligence Platform</span>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-xs font-semibold text-indigo-300 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Phase 2 — Business Registration
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-100 mb-3">
              Create your workspace
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
              Register your business to start collecting and analysing customer feedback with AI-powered decision intelligence.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-8 shadow-[0_32px_80px_rgba(0,0,0,0.4)]">

            {/* Business Name */}
            <div className="mb-6">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                Business Name
              </label>
              <input
                type="text"
                id="input-business-name"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Apollo Hospital Chennai"
                className="w-full bg-[#161827] border border-white/8 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                autoFocus
              />
            </div>

            {/* Industry */}
            <div className="mb-6">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                Industry
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.value}
                    type="button"
                    id={`industry-${ind.value.replace(/\s/g, "-").toLowerCase()}`}
                    onClick={() => setIndustry(ind.value)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all duration-150 ${
                      industry === ind.value
                        ? "border-indigo-500 bg-indigo-500/12 text-slate-100"
                        : "border-white/6 bg-[#161827] text-slate-400 hover:border-white/15 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-base">{ind.icon}</span>
                    <span className="text-xs">{ind.value}</span>
                  </button>
                ))}
              </div>
              {selected && (
                <p className="mt-2 text-[11px] text-slate-500">
                  {selected.group === "qr"
                    ? "🎯 QR-based customer feedback collection will be enabled."
                    : selected.group === "physical"
                    ? "📲 QR code generation and feedback form will be enabled."
                    : "📊 CSV upload, Play Store, and App Store imports will be enabled."
                  }
                </p>
              )}
            </div>

            {/* Email */}
            <div className="mb-7">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                Business Email
              </label>
              <input
                type="email"
                id="input-email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. feedback@company.com"
                className="w-full bg-[#161827] border border-white/8 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm mb-5">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="btn-register"
              type="submit"
              disabled={loading || !businessName || !industry || !email}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-[0_0_24px_rgba(99,102,241,0.3)] hover:shadow-[0_0_36px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating workspace…
                </>
              ) : (
                "Create Workspace →"
              )}
            </button>

            <p className="text-center text-[11px] text-slate-600 mt-4">
              No credit card required · Free during beta
            </p>
          </form>

          {/* Already have workspace */}
          <p className="text-center text-xs text-slate-500 mt-6">
            Have a workspace?{" "}
            <Link href="/" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Analyse customer feedback →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
