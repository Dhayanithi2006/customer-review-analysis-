"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadCSV, uploadPlayStore } from "@/lib/api";
import { Button } from "@/components/ui/button";

const TEAM_SIZES = [
  { id: "solo",      label: "Solo Founder" },
  { id: "2_5",       label: "2–5 People"  },
  { id: "5_10_plus", label: "5–10+"       },
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode]         = useState<"play_store" | "csv">("play_store");
  const [appId, setAppId]       = useState("com.spotify.music");
  const [file, setFile]         = useState<File | null>(null);
  const [teamSize, setTeamSize] = useState("2_5");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) { setError("Please upload a .csv file."); return; }
    setFile(f);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setUploading(true);
    setError(null);
    try {
      if (mode === "play_store") {
        if (!appId.trim()) { setError("Please enter a Play Store App Package ID."); setUploading(false); return; }
        const result = await uploadPlayStore(appId.trim(), 200, teamSize);
        router.push(`/dashboard/${result.session_id}/processing`);
      } else {
        if (!file) { setError("Please select a CSV file."); setUploading(false); return; }
        const result = await uploadCSV(file, "csv", teamSize);
        router.push(`/dashboard/${result.session_id}/processing`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Processing failed. Please try again.");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090e] text-slate-100 overflow-x-hidden font-sans">

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[15%] w-[700px] h-[700px] bg-indigo-600/6 rounded-full blur-[140px]" />
        <div className="absolute top-[5%] right-[5%] w-[450px] h-[450px] bg-cyan-500/4 rounded-full blur-[110px]" />
      </div>

      {/* ─────────────────────────── NAVBAR ─────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#08090e]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-xl px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm shadow-[0_0_14px_rgba(99,102,241,0.45)]">
              🗺️
            </div>
            <span className="font-black text-sm tracking-tight">RoadmapAI</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors hidden sm:block">How it Works</a>
            <a href="#decision-example" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors hidden sm:block">Example</a>
            <a href="#sources" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors hidden sm:block">Sources</a>
            <Link href="/history" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">Past Sessions</Link>
            <Link href="/register" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors hidden sm:block">Register Business</Link>
            <a href="#analyze" className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — HERO                                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center" id="hero">
        <div className="mx-auto max-w-screen-xl px-6 w-full py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-xs font-semibold text-indigo-300 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AI Product Decision Intelligence Platform
              </div>

              <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.06] mb-6">
                Turn customer feedback into{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  revenue-driven
                </span>{" "}
                product decisions.
              </h1>

              <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-lg">
                Know exactly what to build next before revenue drops. Collect feedback from any source, automatically identify the issues costing you the most, and generate an evidence-backed sprint plan.
              </p>

              <ul className="flex flex-col gap-2 mb-10">
                {[
                  "Collect customer feedback from multiple sources",
                  "Automatically categorize and cluster feedback by impact",
                  "Prioritize high-revenue problems — not just popular requests",
                  "Generate roadmap and Jira-ready sprint recommendations",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-[10px] shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex gap-3 flex-wrap">
                <a href="#analyze" className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-[0_0_24px_rgba(99,102,241,0.35)] hover:shadow-[0_0_36px_rgba(99,102,241,0.5)]">
                  Analyze Customer Feedback →
                </a>
                <a href="#decision-example" className="px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/3 hover:bg-white/6 text-slate-200 text-sm font-semibold transition-all">
                  View Live Example
                </a>
              </div>
            </div>

            {/* Right — Realistic Dashboard Preview */}
            <div className="animate-fade-in-up hidden lg:block" style={{ animationDelay: "0.15s" }}>
              <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6 bg-[#0a0c14]">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <span className="ml-3 text-xs text-slate-600 font-mono">roadmapai.app/dashboard</span>
                </div>

                {/* Dashboard mockup content */}
                <div className="p-5 space-y-4">
                  {/* Analysis Health bar */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Analysis Quality</span>
                    <span className="text-xs font-bold text-emerald-400">96% ✓</span>
                  </div>

                  {/* Metric row */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: "Revenue at Risk", value: "₹3.8L", color: "text-red-400" },
                      { label: "Critical Issues", value: "4", color: "text-amber-400" },
                      { label: "Reviews Analysed", value: "2,041", color: "text-indigo-400" },
                    ].map((m, i) => (
                      <div key={i} className="rounded-xl bg-[#161827] border border-white/5 p-3">
                        <p className="text-[10px] text-slate-500 mb-1">{m.label}</p>
                        <p className={`text-base font-black font-mono ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Priority list */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">Priority Issues</p>
                    {[
                      { rank: 1, key: "PAYMENT_RETRIES_FAIL", cat: "Bug", count: 623, risk: "₹2.1L", sev: 9 },
                      { rank: 2, key: "CHECKOUT_CRASH",        cat: "Bug", count: 318, risk: "₹1.2L", sev: 8 },
                      { rank: 3, key: "AUTH_SESSION_EXPIRE",   cat: "Bug", count: 204, risk: "₹0.5L", sev: 7 },
                    ].map((issue) => (
                      <div key={issue.rank} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#161827] hover:border-indigo-500/20 transition-colors">
                        <span className="text-xs font-black text-slate-500 w-4">#{issue.rank}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-200 truncate">{issue.key.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-slate-500">{issue.count} reviews · {issue.cat}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-red-400">{issue.risk}</p>
                          <div className="flex items-center gap-1 justify-end">
                            <div className="h-1 w-8 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${(issue.sev / 10) * 100}%` }} />
                            </div>
                            <span className="text-[9px] text-slate-600">{issue.sev}/10</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA bar */}
                  <div className="flex gap-2">
                    <div className="flex-1 py-2 text-center rounded-lg bg-indigo-600/15 border border-indigo-500/25 text-indigo-400 text-[11px] font-semibold">🗺️ View Roadmap</div>
                    <div className="flex-1 py-2 text-center rounded-lg bg-white/4 border border-white/8 text-slate-400 text-[11px] font-semibold">⚡ Sprint Plan</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — WHY COMPANIES LOSE REVENUE                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6 bg-[#050508]">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-4">The Business Problem</p>
            <h2 className="text-4xl font-black tracking-tight mb-4">Why companies lose revenue</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Most companies collect feedback. Very few know what actually matters.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                number: "01",
                title: "Nobody reads the reviews",
                desc: "Thousands of customer reviews pile up across Play Store, App Store, and support tickets. Zero time to process them.",
                accent: "text-red-400 border-red-500/20 bg-red-500/4",
              },
              {
                number: "02",
                title: "Feedback is scattered",
                desc: "Different teams use different tools. Support has Zendesk, growth has surveys, product has sticky notes. Nothing connects.",
                accent: "text-amber-400 border-amber-500/20 bg-amber-500/4",
              },
              {
                number: "03",
                title: "Popular ≠ important",
                desc: "Companies build what's most requested, not what has the highest revenue impact. The loudest users aren't always the most valuable.",
                accent: "text-purple-400 border-purple-500/20 bg-purple-500/4",
              },
              {
                number: "04",
                title: "Revenue-impacting bugs go unnoticed",
                desc: "A payment failure affecting 300 premium users hides inside 10,000 reviews. By the time it's found, customers have churned.",
                accent: "text-indigo-400 border-indigo-500/20 bg-indigo-500/4",
              },
            ].map((card, i) => (
              <div key={i} className={`rounded-2xl border p-6 ${card.accent} transition-all hover:-translate-y-1 duration-200`}>
                <div className={`text-4xl font-black font-mono mb-5 opacity-30 ${card.accent.split(" ")[0]}`}>{card.number}</div>
                <h3 className="font-bold text-slate-100 mb-3 text-sm leading-snug">{card.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <p className="text-lg font-semibold text-slate-200">
              Most companies collect feedback.{" "}
              <span className="text-indigo-400">Very few know what actually matters.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — HOW BETTER PRODUCT DECISIONS ARE MADE             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6" id="how-it-works">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-4">The RoadmapAI Decision Engine</p>
            <h2 className="text-4xl font-black tracking-tight mb-4">How better product decisions are made</h2>
            <p className="text-slate-400 max-w-lg mx-auto">A deterministic 7-step pipeline — not a chatbot prompt. Every decision is evidence-backed.</p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Vertical connector line */}
            <div className="absolute left-6 top-10 bottom-10 w-px bg-gradient-to-b from-indigo-500/50 via-purple-500/30 to-cyan-500/20 hidden lg:block" />

            <div className="flex flex-col gap-4">
              {[
                { step: "01", icon: "📥", title: "Customer Feedback Ingested", desc: "Play Store, App Store, CSV, and support tickets — normalized into one unified schema.", color: "indigo" },
                { step: "02", icon: "🧹", title: "AI Categorization", desc: "Gemini Flash categorizes each review by type (Bug, UX, Feature Request, Performance) and business area.", color: "violet" },
                { step: "03", icon: "🔗", title: "Issue Clustering", desc: "Similar complaints are grouped into issue clusters. 400 different phrasing of the same payment bug become one cluster.", color: "purple" },
                { step: "04", icon: "💰", title: "Revenue Impact Calculated", desc: "Every cluster gets a revenue-at-risk score based on premium user count, severity, and review volume.", color: "fuchsia" },
                { step: "05", icon: "📊", title: "Priority Engine Runs", desc: "A deterministic formula (not AI guesswork) ranks every issue by business impact. Bugs costing revenue rank above popular requests.", color: "pink" },
                { step: "06", icon: "🗺️", title: "6-Week Roadmap Generated", desc: "Issues are sequenced by effort and impact into a realistic 6-week product roadmap.", color: "rose" },
                { step: "07", icon: "⚡", title: "Jira Sprint Created", desc: "Full sprint plan with user stories, acceptance criteria, and story points — ready to import.", color: "orange" },
              ].map((step, i) => (
                <div key={i} className="flex gap-6 items-start group">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-[#0f111a] border border-white/8 flex items-center justify-center text-xl shadow-sm group-hover:border-indigo-500/30 transition-colors">
                    {step.icon}
                  </div>
                  <div className="flex-1 pt-2.5 pb-5 border-b border-white/5 last:border-0">
                    <div className="flex items-baseline gap-3 mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-600">{step.step}</span>
                      <h3 className="font-bold text-slate-100 text-sm">{step.title}</h3>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — REVENUE IMPACT CARDS                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6 bg-[#050508]">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-red-400 font-bold mb-4">Revenue Intelligence</p>
            <h2 className="text-4xl font-black tracking-tight mb-4">Every analysis shows your revenue exposure</h2>
            <p className="text-slate-400 max-w-md mx-auto">Translated from customer frustration into numbers your CEO understands.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: "🔴",
                label: "Revenue at Risk",
                value: "₹3.8L",
                desc: "Estimated monthly revenue at risk from unresolved critical bugs. Calculated from premium user count × ARPU.",
                why: "Quantifies the cost of not fixing the issue.",
              },
              {
                icon: "⚠️",
                label: "Critical Issues",
                value: "4",
                desc: "The number of issue clusters with severity ≥ 8 affecting paying customers. Requires immediate sprint attention.",
                why: "Separates signal from noise automatically.",
              },
              {
                icon: "📉",
                label: "Estimated Churn",
                value: "12%",
                desc: "Projected subscriber churn if top 2 critical bugs remain unresolved for the next 30 days.",
                why: "Makes the cost of delay visible and urgent.",
              },
              {
                icon: "👑",
                label: "Premium Users Affected",
                value: "127",
                desc: "Number of paying or premium-tier users experiencing the highest-priority issues. Directly tied to MRR.",
                why: "Ensures premium users get priority attention.",
              },
              {
                icon: "🏆",
                label: "Top Revenue Loss",
                value: "PAYMENT_RETRIES_FAIL",
                desc: "The single highest-impact issue cluster, responsible for 55% of total revenue at risk across all sessions.",
                why: "One issue to fix first. No ambiguity.",
              },
              {
                icon: "✅",
                label: "Recovery Potential",
                value: "+18%",
                desc: "Expected revenue recovery after resolving the top 3 critical issues in one sprint cycle.",
                why: "Connects product work directly to business outcomes.",
              },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl border border-white/7 bg-[#0d0f1a] p-6 hover:border-white/12 transition-all duration-200 hover:-translate-y-0.5 group">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-2xl">{card.icon}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-600 uppercase">Why it matters</span>
                </div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-2">{card.label}</p>
                <p className="text-2xl font-black font-mono text-slate-100 mb-3">{card.value}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{card.desc}</p>
                <div className="pt-3 border-t border-white/5 text-xs text-indigo-400 font-medium">{card.why}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — DECISION EXAMPLE (HIGH IMPACT)                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6" id="decision-example">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-4">Decision Intelligence</p>
            <h2 className="text-4xl font-black tracking-tight mb-4">From raw reviews to an actionable decision</h2>
            <p className="text-slate-400 max-w-lg mx-auto">This is how RoadmapAI transforms 623 scattered complaints into a single, confident business decision.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start max-w-5xl mx-auto">
            {/* LEFT — Raw Reviews */}
            <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/6 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-300">623 Raw Customer Reviews</span>
                <span className="ml-auto text-[10px] text-slate-600 font-mono">Google Play Store</span>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { text: "Payment failed after update. Money deducted but order not placed.", rating: "★☆☆☆☆", date: "2 days ago" },
                  { text: "Money deducted but order was not placed. This is unacceptable.", rating: "★☆☆☆☆", date: "3 days ago" },
                  { text: "Unable to retry payment. App just shows loading spinner forever.", rating: "★★☆☆☆", date: "4 days ago" },
                  { text: "UPI timeout every single time. Lost ₹2,000. Please fix urgently.", rating: "★☆☆☆☆", date: "5 days ago" },
                  { text: "Checkout button does nothing after payment confirmation screen.", rating: "★★☆☆☆", date: "6 days ago" },
                  { text: "Payment gateway keeps timing out. Third time this week.", rating: "★☆☆☆☆", date: "1 week ago" },
                ].map((review, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-[#161827] border border-white/5">
                    <p className="text-xs text-slate-300 leading-relaxed mb-2">&ldquo;{review.text}&rdquo;</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                      <span className="text-amber-500/70">{review.rating}</span>
                      <span>{review.date}</span>
                    </div>
                  </div>
                ))}
                <div className="text-center pt-2">
                  <span className="text-[10px] text-slate-600">+ 617 more reviews with similar themes…</span>
                </div>
              </div>
            </div>

            {/* RIGHT — RoadmapAI Decision */}
            <div className="space-y-4">
              {/* Arrow label */}
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-2">
                <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-transparent to-indigo-500/50" />
                <span className="text-xs font-bold text-indigo-400">RoadmapAI Decision</span>
                <div className="h-px flex-1 max-w-[60px] bg-gradient-to-l from-transparent to-indigo-500/50" />
              </div>

              {/* Decision card */}
              <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/8 to-violet-500/4 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm">🎯</div>
                  <div>
                    <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold">Issue Cluster Identified</p>
                    <h3 className="font-black text-slate-100 text-lg tracking-tight">Payment Failure</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: "Frequency",          value: "623 Reviews",  color: "text-slate-100" },
                    { label: "Severity",            value: "Critical",     color: "text-red-400" },
                    { label: "Est. Revenue Loss",   value: "₹3.8L/mo",    color: "text-red-400" },
                    { label: "Premium Users",       value: "127 affected", color: "text-amber-400" },
                  ].map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/6">
                      <p className="text-[10px] text-slate-500 mb-1">{m.label}</p>
                      <p className={`text-sm font-black font-mono ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/12 border border-indigo-500/20 mb-4">
                  <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold mb-1">AI Recommendation</p>
                  <p className="text-sm font-semibold text-slate-100">Move to Sprint 12 · Highest priority</p>
                </div>

                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                  <span className="text-emerald-400">↑</span>
                  <p className="text-xs text-emerald-300 font-semibold">Expected Revenue Recovery: <span className="font-black">+18%</span> after resolution</p>
                </div>
              </div>

              {/* Sprint card */}
              <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Generated Sprint Story</p>
                <p className="text-sm font-bold text-slate-100 mb-2">Fix UPI Payment Retry on Timeout</p>
                <p className="text-xs text-slate-400 italic mb-3">&ldquo;As a premium user, when my UPI payment times out I want the app to automatically retry so that I don&apos;t lose my order.&rdquo;</p>
                <div className="flex gap-2 text-[10px]">
                  <span className="px-2.5 py-1 rounded-md bg-red-500/12 border border-red-500/25 text-red-400 font-semibold">Critical</span>
                  <span className="px-2.5 py-1 rounded-md bg-indigo-500/12 border border-indigo-500/25 text-indigo-400 font-semibold">5 Story Points</span>
                  <span className="px-2.5 py-1 rounded-md bg-white/6 border border-white/8 text-slate-400 font-semibold">Sprint 12</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 6 — INTELLIGENT COUNTER EXAMPLE                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 border-t border-white/6 bg-[#050508]">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">Intelligent Prioritization</p>
              <h2 className="text-3xl font-black tracking-tight mb-3">Not every request is equal</h2>
              <p className="text-slate-400 max-w-md mx-auto">521 users asked for dark mode. RoadmapAI explains exactly why you shouldn&apos;t build it next.</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 items-center">
              {/* Reviews */}
              <div className="rounded-2xl border border-white/8 bg-[#0d0f1a] p-5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">521 Feature Requests</p>
                <div className="space-y-2.5">
                  {[
                    "Need dark mode. My eyes hurt at night using this app.",
                    "OLED mode would be amazing, pure black background please!",
                    "Night theme is essential. Every other app has it.",
                    "Please add a dark UI option, the white is blinding.",
                    "Dark mode when? Been waiting 2 years for this.",
                  ].map((text, i) => (
                    <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-[#161827] border border-white/5">
                      <span className="text-slate-600 text-xs mt-0.5">◦</span>
                      <p className="text-xs text-slate-300 leading-relaxed">&ldquo;{text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/4 p-6">
                  <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-4">RoadmapAI Ruling</p>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: "Frequency",      value: "521 Reviews", color: "text-slate-100" },
                      { label: "Revenue Impact", value: "Low",         color: "text-slate-400" },
                      { label: "Priority Rank",  value: "#7",          color: "text-slate-400" },
                      { label: "Sprint",         value: "Backlog",     color: "text-slate-400" },
                    ].map((m, i) => (
                      <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/6">
                        <p className="text-[10px] text-slate-500 mb-1">{m.label}</p>
                        <p className={`text-sm font-black font-mono ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-black/20 border border-white/8">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Why not now?</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Fixing payment failures recovers <strong className="text-white">₹3.8L/month</strong> in revenue. Dark mode carries{" "}
                      <strong className="text-white">zero direct revenue impact</strong>. High frequency doesn&apos;t mean high priority.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/6 bg-[#0d0f1a] text-center">
                  <p className="text-xs text-slate-400">
                    Popular requests ≠ important problems.{" "}
                    <span className="text-indigo-400 font-semibold">Revenue evidence decides priority.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 7 — SUPPORTED SOURCES                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6" id="sources">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-4">Data Sources</p>
            <h2 className="text-4xl font-black tracking-tight mb-4">Every feedback source. One unified analysis.</h2>
            <p className="text-slate-400 max-w-lg mx-auto">All sources are normalized into a unified review schema before analysis begins.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon: "🤖", name: "Google Play Store",   desc: "Fetch live reviews by Package ID. Auto-scraped.", badge: "Live",        badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
              { icon: "📄", name: "CSV Upload",           desc: "Upload any export. Columns auto-detected.",     badge: "Live",        badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
              { icon: "🍎", name: "App Store",            desc: "Apple App Store review ingestion.",             badge: "Live",        badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
              { icon: "🎧", name: "Support Tickets",      desc: "CSV export from any helpdesk tool.",            badge: "Live",        badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
              { icon: "⭐", name: "Google Reviews",       desc: "Business and product feedback via Google.",     badge: "Coming Soon", badgeColor: "bg-slate-500/15 text-slate-400 border-slate-500/25" },
              { icon: "🔗", name: "Zendesk",              desc: "Direct connector. Bi-directional sync.",        badge: "Coming Soon", badgeColor: "bg-slate-500/15 text-slate-400 border-slate-500/25" },
              { icon: "💬", name: "Intercom",             desc: "Customer conversations → issue clusters.",     badge: "Coming Soon", badgeColor: "bg-slate-500/15 text-slate-400 border-slate-500/25" },
            ].map((source, i) => (
              <div key={i} className="rounded-2xl border border-white/7 bg-[#0d0f1a] p-5 hover:border-white/12 transition-all duration-200 hover:-translate-y-0.5 group">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{source.icon}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${source.badgeColor}`}>{source.badge}</span>
                </div>
                <p className="font-bold text-slate-100 text-sm mb-1.5">{source.name}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{source.desc}</p>
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] text-slate-600 italic">Normalized into one unified schema.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 8 — WHY NOT CHATGPT?                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6 bg-[#050508]">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">Comparison</p>
            <h2 className="text-4xl font-black tracking-tight mb-4">Why not just use ChatGPT?</h2>
            <p className="text-slate-400 max-w-md mx-auto">ChatGPT is a conversation. RoadmapAI is a workflow.</p>
          </div>

          <div className="max-w-3xl mx-auto rounded-2xl border border-white/8 bg-[#0d0f1a] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-3 bg-[#0a0c14] border-b border-white/6">
              <div className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest col-span-1">Capability</div>
              <div className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">ChatGPT</div>
              <div className="px-6 py-4 text-xs font-bold text-indigo-400 uppercase tracking-widest text-center">RoadmapAI</div>
            </div>

            {[
              { capability: "Collect feedback automatically",    chatgpt: false, us: true  },
              { capability: "Scrape Play Store / App Store",     chatgpt: false, us: true  },
              { capability: "Group similar complaints",          chatgpt: "Manual prompt", us: true  },
              { capability: "Calculate revenue at risk",         chatgpt: false, us: true  },
              { capability: "Prioritize by business impact",     chatgpt: false, us: true  },
              { capability: "Generate 6-week roadmap",          chatgpt: false, us: true  },
              { capability: "Create Jira sprint with stories",   chatgpt: false, us: true  },
              { capability: "Decisions backed by evidence",      chatgpt: false, us: true  },
              { capability: "Works without re-pasting reviews",  chatgpt: false, us: true  },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-3 border-b border-white/5 last:border-0 hover:bg-white/[0.015] transition-colors`}>
                <div className="px-6 py-3.5 text-xs text-slate-300 font-medium">{row.capability}</div>
                <div className="px-6 py-3.5 text-center">
                  {row.chatgpt === false ? (
                    <span className="text-red-500/70 text-sm">✗</span>
                  ) : (
                    <span className="text-xs text-slate-500">{row.chatgpt}</span>
                  )}
                </div>
                <div className="px-6 py-3.5 text-center">
                  {row.us ? <span className="text-emerald-400 text-sm font-bold">✓</span> : <span className="text-red-500/70 text-sm">✗</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION ANALYZE — UPLOAD FORM                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6" id="analyze">
        <div className="mx-auto max-w-screen-xl px-6">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-4">Get Started</p>
            <h2 className="text-4xl font-black tracking-tight mb-4">Analyze your customer feedback</h2>
            <p className="text-slate-400">Upload a CSV or enter a Play Store app ID. Results in under 3 minutes.</p>
          </div>

          <div className="max-w-xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-[#0f111a] shadow-[0_0_60px_rgba(99,102,241,0.07)] p-8">
              {/* Mode toggle */}
              <div className="mb-7">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Choose Source</p>
                <div className="flex gap-2 p-1 rounded-xl bg-[#161827] border border-white/7">
                  <button
                    onClick={() => setMode("play_store")}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 ${mode === "play_store" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    🤖 Play Store Scraper
                  </button>
                  <button
                    onClick={() => setMode("csv")}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 ${mode === "csv" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    📄 Upload CSV
                  </button>
                </div>
              </div>

              {/* Team size */}
              <div className="mb-7">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Team Size</p>
                <div className="flex gap-2">
                  {TEAM_SIZES.map(t => (
                    <button
                      key={t.id}
                      id={`team-${t.id}`}
                      onClick={() => setTeamSize(t.id)}
                      className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${teamSize === t.id ? "border-indigo-500 bg-indigo-500/12 text-slate-100" : "border-white/7 bg-[#161827] text-slate-400 hover:border-white/15"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              {mode === "play_store" ? (
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Play Store Package ID</p>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. com.spotify.music"
                    className="w-full bg-[#161827] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <div className="flex gap-2 flex-wrap mt-2 text-xs text-slate-600">
                    <span>Try:</span>
                    {["com.spotify.music", "com.whatsapp", "com.duolingo"].map(app => (
                      <button key={app} onClick={() => setAppId(app)} className="text-indigo-400 hover:underline font-mono">{app}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Upload CSV File</p>
                  <div
                    id="upload-dropzone"
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? "border-indigo-500 bg-indigo-500/8" : file ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/4"}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    {file ? (
                      <div><div className="text-3xl mb-2">✅</div><p className="font-bold text-sm text-slate-100">{file.name}</p><p className="text-xs text-slate-500 mt-1">{(file.size/1024).toFixed(0)} KB · Click to change</p></div>
                    ) : (
                      <div><div className="text-4xl mb-3 animate-float">📂</div><p className="font-semibold text-sm text-slate-200 mb-1">Drop your CSV here</p><p className="text-xs text-slate-500">or click to browse · max 50 MB</p></div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-4">
                  ⚠️ {error}
                </div>
              )}

              <Button
                id="btn-analyze"
                onClick={handleSubmit}
                disabled={uploading || (mode === "csv" && !file) || (mode === "play_store" && !appId.trim())}
                size="lg"
                className="w-full justify-center"
              >
                {uploading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
                ) : (
                  <>🚀 Analyze Customer Feedback</>
                )}
              </Button>

              <p className="text-center text-[11px] text-slate-600 mt-4">
                No account required · Results in ~3 minutes · Evidence-backed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 9 — FINAL CTA                                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="py-28 border-t border-white/6 bg-[#050508]">
        <div className="mx-auto max-w-screen-xl px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-5xl font-black tracking-tight mb-6 leading-tight">
              Ready to know what is{" "}
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">costing your company</span>{" "}
              the most revenue?
            </h2>
            <p className="text-slate-400 text-lg mb-10">
              Stop guessing. Start knowing. 3 minutes from raw reviews to your next sprint plan.
            </p>
            <a href="#analyze" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-base font-bold transition-all shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:shadow-[0_0_60px_rgba(99,102,241,0.55)]">
              Analyze Customer Feedback →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/6 py-10">
        <div className="mx-auto max-w-screen-xl px-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xs">🗺️</div>
            <span className="font-black text-sm tracking-tight text-slate-200">RoadmapAI</span>
            <span className="text-slate-600 text-xs ml-1">— AI Product Decision Intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <Link href="/history" className="hover:text-slate-400 transition-colors">Past Sessions</Link>
            <span>Built for Hacklab</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
