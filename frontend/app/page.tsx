"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadCSV } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BrandMark } from "@/components/layout/top-nav";
import {
  PriorityContrastExample,
  PipelineStrip,
  AnalyticsPreviewCard,
} from "@/components/landing/illustrations";
import {
  LayoutDashboard,
  AlertTriangle,
  MessageSquareText,
  Map,
  Zap,
  QrCode,
  SlidersHorizontal,
  Sparkles,
  Upload,
  CheckCircle2,
} from "lucide-react";

const TEAM_SIZES = [
  { id: "solo", label: "Solo" },
  { id: "2_5", label: "2–5" },
  { id: "5_10_plus", label: "5–10+" },
];

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#analyze", label: "Analyze CSV" },
  { href: "/register", label: "Create workspace", external: true },
];

const PIPELINE = [
  {
    step: "01",
    t: "Collect",
    d: "QR, direct link, or CSV data into one workspace.",
    icon: QrCode,
  },
  {
    step: "02",
    t: "Understand",
    d: "Cluster unstructured complaints into clear issues.",
    icon: Sparkles,
  },
  {
    step: "03",
    t: "Prioritize",
    d: "Rank by revenue risk and reach — not volume alone.",
    icon: AlertTriangle,
  },
  {
    step: "04",
    t: "Act",
    d: "Generate roadmap, sprint stories, and log real fixes.",
    icon: Zap,
  },
  {
    step: "05",
    t: "Measure",
    d: "Follow up with customers and mark Improved or Reopened.",
    icon: CheckCircle2,
  },
];

const QUICK_PANELS = [
  {
    title: "Overview Dashboard",
    href: "/business/freshmart",
    icon: LayoutDashboard,
    badge: "Live",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  {
    title: "Decision Center",
    href: "/business/freshmart/analysis",
    icon: AlertTriangle,
    badge: "18 Issues",
    badgeColor: "bg-red-500/15 text-red-400 border-red-500/25",
  },
  {
    title: "Customer Feedback",
    href: "/business/freshmart/reviews",
    icon: MessageSquareText,
    badge: "2,041 Total",
    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  },
  {
    title: "Product Roadmap",
    href: "/business/freshmart/roadmap",
    icon: Map,
    badge: "4 Weeks",
    badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  },
  {
    title: "Sprint Planning",
    href: "/business/freshmart/sprint",
    icon: Zap,
    badge: "Stories",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
  {
    title: "QR Code Portal",
    href: "/business/freshmart/sources",
    icon: QrCode,
    badge: "Ready",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  {
    title: "Workspace Settings",
    href: "/business/freshmart/settings",
    icon: SlidersHorizontal,
    badge: "Config",
    badgeColor: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  },
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [teamSize, setTeamSize] = useState("2_5");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    if (f) handleFile(f);
  }, []);

  const handleSubmit = async () => {
    setUploading(true);
    setError(null);
    try {
      if (!file) {
        setError("Please select a CSV file.");
        setUploading(false);
        return;
      }
      const result = await uploadCSV(file, "csv", teamSize);
      router.push(`/dashboard/${result.session_id}/processing`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Processing failed. Please try again."
      );
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white relative overflow-x-hidden font-sans">
      {/* Background Ambient Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,_rgba(109,93,246,0.18),_transparent_60%)]"
      />

      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0B0E14]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="px-2.5 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-primary-soft flex items-center gap-2 transition-colors cursor-pointer"
              title="Toggle Quick Access Panels"
            >
              <LayoutDashboard size={14} />
              <span className="hidden sm:inline">Workspace Panels</span>
            </button>

            <BrandMark />
            <span className="hidden xl:inline text-xs text-slate-500 font-medium">
              From Customer Voice to Business Growth Decisions
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6">
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

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-full hidden sm:inline-flex border-white/[0.12] hover:bg-white/[0.06]">
              <Link href="/business/freshmart">Try Sample Data</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full shadow-[0_4px_18px_rgba(109,93,246,0.4)]">
              <Link href="/register">Create Workspace</Link>
            </Button>
            <button
              type="button"
              className="md:hidden w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-slate-300"
              onClick={() => setMobileNav((v) => !v)}
              aria-label="Toggle navigation"
            >
              {mobileNav ? "×" : "☰"}
            </button>
          </div>
        </div>

        {mobileNav && (
          <div className="md:hidden border-t border-white/[0.06] px-5 py-4 flex flex-col gap-3 bg-[#0B0E14]">
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
            <Button asChild variant="outline" size="sm">
              <Link href="/business/freshmart">Try Sample Data</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Create Workspace</Link>
            </Button>
          </div>
        )}
      </nav>

      {/* Slide-out Quick Access Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-50 w-80 max-w-[85vw] bg-[#0E131F] border-r border-white/[0.08] p-5 flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">RoadmapAI</p>
                  <p className="text-[10px] text-slate-400">Quick Access Panels</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">
                Workspace Views
              </p>
              {QUICK_PANELS.map((panel) => {
                const Icon = panel.icon;
                return (
                  <Link
                    key={panel.title}
                    href={panel.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all no-underline group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon size={16} className="text-slate-400 group-hover:text-primary-soft shrink-0" />
                      <span className="truncate">{panel.title}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${panel.badgeColor}`}>
                      {panel.badge}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="pt-5 border-t border-white/[0.08] mt-5">
              <div className="rounded-xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent border border-primary/25 p-3.5 mb-3">
                <p className="text-xs font-bold text-white mb-1">FreshMart Supermarket</p>
                <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
                  Live pre-seeded workspace with closed-loop resolution engine.
                </p>
                <Button asChild size="sm" className="w-full text-xs rounded-lg">
                  <Link href="/business/freshmart" onClick={() => setSidebarOpen(false)}>
                    Open Workspace →
                  </Link>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="relative">
        {/* Hero Section */}
        <section id="product" className="pt-12 pb-16 md:pt-16 md:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Left Column */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary-soft">
                  <Sparkles size={13} />
                  <span>RoadmapAI Decision Engine</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12] text-white">
                  Turn customer feedback into the problems your business{" "}
                  <span className="bg-gradient-to-r from-[#8B7FF8] via-[#A78BFA] to-[#38BDF8] bg-clip-text text-transparent">
                    should fix first
                  </span>
                  .
                </h1>

                <p className="text-base text-slate-400 leading-relaxed max-w-xl">
                  RoadmapAI analyzes customer feedback, calculates revenue impact, and turns
                  high-exposure complaints into actionable product roadmaps with closed-loop verification.
                </p>

                <div className="pt-1">
                  <PipelineStrip />
                </div>

                <div className="pt-3 flex flex-wrap items-center gap-3.5">
                  <Button asChild size="lg" className="rounded-full shadow-[0_6px_24px_rgba(109,93,246,0.45)] px-7 font-bold">
                    <Link href="/register">Create Workspace</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full border-white/[0.15] hover:bg-white/[0.06] font-semibold">
                    <Link href="/business/freshmart">Try Sample Data</Link>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="px-4 py-2.5 rounded-full border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-slate-300 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <LayoutDashboard size={14} className="text-primary-soft" />
                    <span>Open Side Panels →</span>
                  </button>
                </div>

                <p className="text-xs text-slate-500 pt-1">
                  Or{" "}
                  <a href="#analyze" className="text-slate-300 underline underline-offset-4 hover:text-white">
                    upload a CSV below
                  </a>{" "}
                  to analyze without registering.
                </p>
              </div>

              {/* Right Column Visuals */}
              <div className="lg:col-span-5 space-y-4">
                <PriorityContrastExample />
                <AnalyticsPreviewCard />
              </div>
            </div>
          </div>
        </section>

        {/* 5-Step Pipeline Grid */}
        <section id="how" className="py-16 md:py-20 border-t border-white/[0.06] bg-[#0E121B]/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-soft mb-2">
                The Product Journey
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                From customer voice to growth decisions
              </h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                A structured decision pipeline — not a generic chatbot. Continuous feedback collection,
                deterministic revenue prioritization, action tracking, and customer outcome measurement.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {PIPELINE.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.t}
                    className="rounded-2xl border border-white/[0.08] bg-[#121622] p-5 hover:border-primary/40 hover:bg-[#161B2A] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-mono text-xs font-extrabold text-primary-soft">
                          {step.step}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-400">
                          <Icon size={14} />
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{step.t}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Analyze CSV Section */}
        <section id="analyze" className="py-16 md:py-24 border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Analyze a CSV
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  No account required. Instant parsing, sentiment scoring, and revenue ranking.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121622] p-6 sm:p-8 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2.5">
                    Team Size
                  </p>
                  <SegmentedControl
                    value={teamSize}
                    onChange={setTeamSize}
                    options={TEAM_SIZES.map((t) => ({ id: t.id, label: t.label }))}
                  />
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    dragOver
                      ? "border-primary bg-primary/10"
                      : file
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-white/10 hover:border-white/20 bg-white/[0.02]"
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
                    <div className="animate-in fade-in duration-200">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2.5 font-bold">
                        ✓
                      </div>
                      <p className="font-bold text-sm text-white">{file.name}</p>
                      <p className="text-xs text-emerald-400 mt-1 font-medium">
                        {(file.size / 1024).toFixed(1)} KB · Ready to analyze
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Click to replace file</p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-primary/12 border border-primary/25 text-primary-soft flex items-center justify-center mx-auto mb-3">
                        <Upload size={20} />
                      </div>
                      <p className="font-bold text-sm text-slate-100">Drop your CSV file here</p>
                      <p className="text-xs text-slate-500 mt-1">or click to browse from your computer</p>
                      <p className="text-[10px] text-slate-600 mt-2 font-mono">
                        Supports review, comment, text, rating, sentiment columns
                      </p>
                    </div>
                  )}
                </div>

                {/* Instant 1-Click Sample Dataset Loaders */}
                <div className="mt-5 pt-5 border-t border-white/[0.06]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3 text-center">
                    Or try an instant sample dataset
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const sampleContent = `"review_text","rating","source"\n"Checkout queue took more than 20 minutes.",1,"retail"\n"UPI payment failed twice at kiosk.",1,"retail"\n"Items out of stock in dairy section.",2,"retail"\n"Parking was completely full on Saturday.",2,"retail"\n"Staff was helpful in finding fruits.",5,"retail"\n"Long queues during evening peak hours.",1,"retail"`;
                        const blob = new Blob([sampleContent], { type: "text/csv" });
                        const sampleFile = new File([blob], "freshmart_retail_sample.csv", { type: "text/csv" });
                        handleFile(sampleFile);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-primary/35 text-left transition-all cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-slate-200">🛒 FreshMart Retail</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Supermarket & checkout</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const sampleContent = `"Text, Sentiment, Source, Date/Time, User ID, Location, Confidence Score"\n"""I love this product!"", Positive, Twitter, 2023-06-15 09:23:14, @user123, New York, 0.85\n"""The service was terrible."", Negative, Yelp Reviews, 2023-06-15 11:45:32, user456, Los Angeles, 0.65\n"""The product arrived damaged."", Negative, Online Store, 2023-07-03 17:25:09, buyer123, Chicago, 0.76\n"""Website is so confusing and poorly designed."", Negative, Website Review, 2023-07-03 11:59:18, user789, Toronto, 0.68\n"""Terrible experience with customer support."", Negative, Online Chat, 2023-07-04 08:32:41, user1234, Sydney, 0.61`;
                        const blob = new Blob([sampleContent], { type: "text/csv" });
                        const sentimentFile = new File([blob], "sentiment-analysis.csv", { type: "text/csv" });
                        handleFile(sentimentFile);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-primary/35 text-left transition-all cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-slate-200">📊 Sentiment Dataset</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Multi-channel feedback</p>
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
                  >
                    {error}
                  </div>
                )}

                <Button
                  onClick={() => handleSubmit()}
                  disabled={uploading || !file}
                  size="lg"
                  className="w-full justify-center mt-5 rounded-full shadow-[0_6px_20px_rgba(109,93,246,0.4)] font-bold text-sm"
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing with AI Engine…
                    </span>
                  ) : (
                    "Analyze CSV with AI Engine →"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 relative bg-[#090C12]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-6">
          <div>
            <BrandMark />
            <p className="text-xs text-slate-500 mt-2">
              From Customer Voice to Business Growth Decisions.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-slate-400">
            <Link href="/business/freshmart" className="hover:text-white transition-colors">
              FreshMart Workspace
            </Link>
            <Link href="/business/freshmart/analysis" className="hover:text-white transition-colors">
              Decision Center
            </Link>
            <Link href="/business/freshmart/roadmap" className="hover:text-white transition-colors">
              Roadmap
            </Link>
            <Link href="/history" className="hover:text-white transition-colors">
              Past Sessions
            </Link>
            <Link href="/register" className="hover:text-white transition-colors">
              Create Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
