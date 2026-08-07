"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Store,
  Sparkles,
  CircleDollarSign,
  FileOutput,
  Lightbulb,
  ShieldCheck,
  Users,
  Link2,
  BarChart3,
  Map,
  ListTodo,
} from "lucide-react";
import { uploadCSV, uploadPlayStore } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BrandMark } from "@/components/layout/top-nav";
import { DecisionCenterMock } from "@/components/landing/illustrations";

const TEAM_SIZES = [
  { id: "solo", label: "Solo Founder" },
  { id: "2_5", label: "2–5 People" },
  { id: "5_10_plus", label: "5–10+" },
];

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#how", label: "Docs" },
  { href: "/history", label: "Changelog", external: true },
];

const HERO_CAPS = [
  { icon: Store, label: "Real app store integration" },
  { icon: Sparkles, label: "AI issue detection & clustering" },
  { icon: CircleDollarSign, label: "Revenue impact scoring" },
  { icon: FileOutput, label: "Jira-ready roadmaps" },
];

const FEATURES = [
  {
    icon: Lightbulb,
    title: "Actionable Insights",
    desc: "Turn thousands of reviews into ranked product decisions your team can ship.",
    tone: "bg-primary/10 text-[#6D5DF6]",
  },
  {
    icon: CircleDollarSign,
    title: "Revenue Impact",
    desc: "See what’s costing you money — severity, reach, and ARPU in one score.",
    tone: "bg-red-500/10 text-red-500",
  },
  {
    icon: FileOutput,
    title: "Jira-Ready Output",
    desc: "Export sprint CSVs and roadmap markdown your eng team can pull tomorrow.",
    tone: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: Link2,
    title: "Evidence-Backed",
    desc: "Every recommendation links to real customer quotes and confidence scores.",
    tone: "bg-amber-500/10 text-amber-600",
  },
  {
    icon: Users,
    title: "Built for Teams",
    desc: "Founders, PMs, and eng share one decision stream — not scattered reports.",
    tone: "bg-sky-500/10 text-sky-600",
  },
  {
    icon: ShieldCheck,
    title: "Production Pipeline",
    desc: "Deterministic cleaning, clustering, and ranking — not a one-off chatbot prompt.",
    tone: "bg-violet-500/10 text-violet-600",
  },
];

const STATS = [
  { icon: CircleDollarSign, value: "₹2.84L", label: "Revenue at risk surfaced" },
  { icon: ShieldCheck, value: "18", label: "Critical issues prioritized" },
  { icon: BarChart3, value: "2,041", label: "Reviews analysed" },
  { icon: Sparkles, value: "94%", label: "AI confidence score" },
  { icon: Map, value: "6 weeks", label: "Roadmaps generated" },
  { icon: ListTodo, value: "24", label: "User stories created" },
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"play_store" | "csv">("play_store");
  const [appId, setAppId] = useState("com.spotify.music");
  const [file, setFile] = useState<File | null>(null);
  const [teamSize, setTeamSize] = useState("2_5");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      if (!f.name.endsWith(".csv")) {
        setError("Please upload a .csv file.");
        return;
      }
      setFile(f);
      setError(null);
    }
  }, []);

  const handleSubmit = async (overrideAppId?: string) => {
    setUploading(true);
    setError(null);
    try {
      if (mode === "play_store" || overrideAppId) {
        const id = (overrideAppId || appId).trim();
        if (!id) {
          setError("Please enter a Play Store App Package ID.");
          setUploading(false);
          return;
        }
        const result = await uploadPlayStore(id, 200, teamSize);
        router.push(`/dashboard/${result.session_id}/processing`);
      } else {
        if (!file) {
          setError("Please select a CSV file.");
          setUploading(false);
          return;
        }
        const result = await uploadCSV(file, "csv", teamSize);
        router.push(`/dashboard/${result.session_id}/processing`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Processing failed. Please try again."
      );
      setUploading(false);
    }
  };

  const runSample = () => {
    setMode("play_store");
    setAppId("com.spotify.music");
    void handleSubmit("com.spotify.music");
  };

  return (
    <div className="min-h-screen bg-background text-white overflow-x-hidden">
      {/* Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute top-[-18%] left-[5%] w-[640px] h-[640px] rounded-full bg-primary/[0.08] blur-[140px]" />
        <div className="absolute top-[20%] right-[-8%] w-[520px] h-[520px] rounded-full bg-primary/[0.05] blur-[130px]" />
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-xl px-5 md:px-8 flex items-center justify-between h-14 gap-4">
          <BrandMark />

          <div className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map((link) =>
              link.external ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runSample}
              disabled={uploading}
            >
              Try Sample Data
            </Button>
            <Button asChild size="sm">
              <a href="#cta">Get Started Free →</a>
            </Button>
          </div>

          <button
            type="button"
            className="md:hidden w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-slate-300"
            onClick={() => setMobileNav((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="text-lg leading-none">{mobileNav ? "×" : "☰"}</span>
          </button>
        </div>

        {mobileNav && (
          <div className="md:hidden border-t border-border px-5 py-4 flex flex-col gap-3 bg-background/95 animate-fade-in">
            {NAV_LINKS.map((link) =>
              link.external ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-slate-300 py-1"
                  onClick={() => setMobileNav(false)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-slate-300 py-1"
                  onClick={() => setMobileNav(false)}
                >
                  {link.label}
                </a>
              )
            )}
            <Button type="button" variant="outline" size="sm" onClick={runSample} disabled={uploading}>
              Try Sample Data
            </Button>
            <Button asChild size="sm">
              <a href="#cta" onClick={() => setMobileNav(false)}>
                Get Started Free →
              </a>
            </Button>
          </div>
        )}
      </nav>

      <main className="relative z-10">
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section id="product" className="relative pt-12 pb-16 lg:pt-16 lg:pb-24">
          <div className="mx-auto max-w-screen-xl px-5 md:px-8">
            <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-12 lg:gap-10 items-center">
              <div className="animate-fade-in-up">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary-soft-2 mb-6">
                  <Sparkles className="size-3.5" aria-hidden />
                  AI-Powered Product Intelligence
                </div>

                <h1 className="text-[2.25rem] sm:text-5xl lg:text-[3.15rem] font-extrabold tracking-tight leading-[1.08] text-white mb-5">
                  Turn customer feedback into{" "}
                  <span className="text-gradient">revenue-driving product decisions</span>.
                </h1>

                <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-lg mb-8">
                  Collect reviews from multiple sources, uncover critical issues, calculate
                  business impact, and get AI-powered roadmaps your team can execute.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 mb-9">
                  {HERO_CAPS.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <span className="w-8 h-8 rounded-xl bg-surface-2 border border-white/[0.08] flex items-center justify-center text-primary-soft shrink-0">
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      {label}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <a href="#cta">Analyze Your Reviews →</a>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <a href="#product-preview">View Demo Dashboard</a>
                  </Button>
                </div>
              </div>

              <div
                id="product-preview"
                className="animate-fade-in-up"
                style={{ animationDelay: "120ms" }}
              >
                <DecisionCenterMock />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features (light) ────────────────────────────────────────── */}
        <section id="features" className="bg-marketing text-marketing-foreground py-20 md:py-24">
          <div className="mx-auto max-w-screen-xl px-5 md:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12 md:mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-marketing-foreground">
                What you get with RoadmapAI
              </h2>
              <p className="mt-3 text-base text-slate-600 leading-relaxed">
                Everything you need to go from feedback to shipped features.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {FEATURES.map(({ icon: Icon, title, desc, tone }) => (
                <div
                  key={title}
                  className="rounded-[18px] bg-marketing-card border border-slate-200/80 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition-shadow"
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${tone}`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold text-marketing-foreground mb-2 tracking-tight">
                    {title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────────────────── */}
        <section className="bg-marketing-muted border-y border-slate-200/80 py-12 md:py-14">
          <div className="mx-auto max-w-screen-xl px-5 md:px-8">
            <div className="text-center mb-8 md:mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-marketing-foreground">
                RoadmapAI in numbers
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Illustrative outcomes from a Play Store analysis run — your results will vary by app.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-[18px] bg-marketing-card border border-slate-200/80 p-4 text-center shadow-[0_4px_16px_rgba(15,23,42,0.04)]"
                >
                  <Icon className="size-4 text-primary mx-auto mb-2" aria-hidden />
                  <p className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-marketing-foreground">
                    {value}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section id="how" className="py-20 md:py-24 border-t border-border">
          <div className="mx-auto max-w-screen-xl px-5 md:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-[11px] uppercase tracking-[0.14em] text-primary-soft font-bold mb-4">
                How it works
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.15]">
                From scattered reviews to a shippable plan.
              </h2>
              <p className="mt-4 text-base text-slate-400 leading-relaxed max-w-xl">
                A deterministic pipeline — ingest, cluster, score revenue impact, then generate
                roadmap and sprint output your team can execute.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              {[
                { n: "01", t: "Ingest", d: "Pull Play Store reviews or upload a CSV of customer feedback." },
                { n: "02", t: "Cluster", d: "AI groups similar complaints into issue clusters with confidence." },
                { n: "03", t: "Score", d: "Revenue-at-risk ranking separates noise from business-critical work." },
                { n: "04", t: "Ship", d: "Get a 6-week roadmap, sprint stories, and Jira-ready exports." },
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-[18px] border border-border bg-surface p-5 shadow-[0_2px_12px_rgba(0,0,0,0.28)]"
                >
                  <p className="font-mono text-xs font-bold text-primary-soft mb-3">{step.n}</p>
                  <h3 className="text-base font-bold text-white mb-2">{step.t}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────── */}
        <section id="pricing" className="py-20 md:py-24 border-t border-border bg-[#0E1424]/50">
          <div className="mx-auto max-w-screen-xl px-5 md:px-8">
            <div className="max-w-xl mx-auto text-center mb-10">
              <p className="text-[11px] uppercase tracking-[0.14em] text-primary-soft font-bold mb-4">
                Pricing
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                Start free. Prove the ROI first.
              </h2>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                No account required for analysis sessions. Register a workspace when you want a
                permanent dashboard URL and feedback QR.
              </p>
            </div>

            <div className="max-w-md mx-auto rounded-[20px] border border-primary/30 bg-surface p-7 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
              <p className="text-sm font-semibold text-primary-soft-2 mb-1">Free during launch</p>
              <p className="text-4xl font-extrabold text-white mb-4">
                ₹0<span className="text-lg text-slate-500 font-semibold"> / analysis</span>
              </p>
              <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                {[
                  "Play Store + CSV ingest",
                  "Revenue-ranked decision dashboard",
                  "6-week roadmap & sprint plan",
                  "Jira CSV + Markdown export",
                  "AI meeting on your session data",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-1 w-4 h-4 rounded-full bg-primary/20 text-primary-soft flex items-center justify-center text-[10px] shrink-0">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="w-full justify-center">
                <a href="#cta">Get Started Free →</a>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Analyze CTA ─────────────────────────────────────────────── */}
        <section id="cta" className="py-20 md:py-28 border-t border-border">
          <div className="mx-auto max-w-screen-xl px-5 md:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
              <p className="text-[11px] uppercase tracking-[0.14em] text-primary-soft font-bold mb-4">
                Analyze
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Ready to see what’s costing you the most?
              </h2>
              <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
                Upload feedback or pull Play Store reviews. Get ranked decisions in minutes.
              </p>
            </div>

            <div className="max-w-xl mx-auto rounded-[20px] border border-white/[0.08] bg-surface shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-6 sm:p-8">
              <div className="mb-7">
                <p className="page-eyebrow mb-3">Source</p>
                <SegmentedControl
                  value={mode}
                  onChange={(id) => setMode(id as "play_store" | "csv")}
                  options={[
                    { id: "play_store", label: "Play Store" },
                    { id: "csv", label: "Upload CSV" },
                  ]}
                />
              </div>

              <div className="mb-7">
                <p className="page-eyebrow mb-3">Team size</p>
                <SegmentedControl
                  value={teamSize}
                  onChange={setTeamSize}
                  options={TEAM_SIZES.map((t) => ({ id: t.id, label: t.label }))}
                />
              </div>

              {mode === "play_store" ? (
                <div className="mb-6">
                  <label
                    htmlFor="input-app-id"
                    className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3"
                  >
                    Play Store package ID
                  </label>
                  <Input
                    id="input-app-id"
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. com.spotify.music"
                    className="font-mono"
                  />
                  <div className="flex gap-2 flex-wrap mt-3 text-xs text-slate-500">
                    <span>Try:</span>
                    {["com.spotify.music", "com.whatsapp", "com.duolingo"].map((app) => (
                      <button
                        key={app}
                        type="button"
                        onClick={() => setAppId(app)}
                        className="text-primary-soft hover:underline font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                      >
                        {app}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3">
                    CSV file
                  </p>
                  <div
                    id="upload-dropzone"
                    role="button"
                    tabIndex={0}
                    className={`border-2 border-dashed rounded-[18px] p-8 text-center cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      dragOver
                        ? "border-primary bg-primary/10"
                        : file
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-white/10 hover:border-primary/40 hover:bg-primary/[0.04]"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    {file ? (
                      <div>
                        <p className="font-bold text-sm text-white">{file.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {(file.size / 1024).toFixed(0)} KB · Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-sm text-slate-200 mb-1">
                          Drop your CSV here
                        </p>
                        <p className="text-xs text-slate-500">or click to browse · max 50 MB</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 rounded-[14px] bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-4"
                >
                  {error}
                </div>
              )}

              <Button
                id="btn-analyze"
                onClick={() => handleSubmit()}
                disabled={
                  uploading ||
                  (mode === "csv" && !file) ||
                  (mode === "play_store" && !appId.trim())
                }
                size="lg"
                className="w-full justify-center"
              >
                {uploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  "Analyze Your Reviews →"
                )}
              </Button>

              <p className="text-center text-[11px] text-slate-500 mt-4">
                No account required · Results in minutes · Evidence-backed
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-10">
        <div className="mx-auto max-w-screen-xl px-5 md:px-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-slate-600 text-xs hidden sm:inline">
              AI Product Decision Intelligence
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link
              href="/history"
              className="hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            >
              Past sessions
            </Link>
            <Link
              href="/register"
              className="hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            >
              Register workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
