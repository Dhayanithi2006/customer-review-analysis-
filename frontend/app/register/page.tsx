"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Smartphone,
  Cloud,
  ShoppingCart,
  Building2,
  GraduationCap,
  Home,
  Store,
  UtensilsCrossed,
  Hotel,
  Landmark,
  Ban,
  FileSpreadsheet,
  QrCode,
  Mail,
  CircleDollarSign,
} from "lucide-react";
import { registerBusiness } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Constants ──────────────────────────────────────────────────────────────

const INDUSTRIES: { value: string; icon: ReactNode; group: string }[] = [
  { value: "Mobile App", icon: <Smartphone className="size-4" />, group: "digital" },
  { value: "SaaS", icon: <Cloud className="size-4" />, group: "digital" },
  { value: "E-commerce", icon: <ShoppingCart className="size-4" />, group: "digital" },
  { value: "Hospital", icon: <Building2 className="size-4" />, group: "physical" },
  { value: "School", icon: <GraduationCap className="size-4" />, group: "physical" },
  { value: "University", icon: <GraduationCap className="size-4" />, group: "physical" },
  { value: "Institute", icon: <GraduationCap className="size-4" />, group: "physical" },
  { value: "Hostel", icon: <Home className="size-4" />, group: "physical" },
  { value: "Supermarket", icon: <Store className="size-4" />, group: "physical" },
  { value: "Restaurant", icon: <UtensilsCrossed className="size-4" />, group: "physical" },
  { value: "Hotel", icon: <Hotel className="size-4" />, group: "physical" },
  { value: "Shop", icon: <Store className="size-4" />, group: "physical" },
  { value: "Bank", icon: <Landmark className="size-4" />, group: "physical" },
];

const FEEDBACK_METHODS: {
  value: string;
  icon: ReactNode;
  label: string;
  desc: string;
  category: "A" | "B" | "none";
}[] = [
  { value: "none", icon: <Ban className="size-4" />, label: "None yet", desc: "I don’t collect feedback yet", category: "none" },
  { value: "qr", icon: <QrCode className="size-4" />, label: "QR Code", desc: "Printable QR → feedback form", category: "A" },
  { value: "csv", icon: <FileSpreadsheet className="size-4" />, label: "CSV / Export", desc: "Existing surveys & exports", category: "B" },
  { value: "email", icon: <Mail className="size-4" />, label: "Email", desc: "Support threads (import later via CSV)", category: "B" },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];

// ─── Small shared components ─────────────────────────────────────────────────

function StepBadge({ step, label, active, done }: { step: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${active ? "opacity-100" : done ? "opacity-60" : "opacity-30"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
        done ? "bg-emerald-500 text-white" : active ? "bg-primary text-white" : "bg-white/10 text-slate-400"
      }`}>
        {done ? "✓" : step}
      </div>
      <span className={`text-xs font-semibold hidden sm:block ${active ? "text-slate-100" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}

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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/8 text-[11px] font-semibold text-slate-300 hover:text-white transition-all shrink-0"
    >
      {copied ? "Copied" : (label || "Copy")}
    </button>
  );
}

// ─── Step 1: Business Info ────────────────────────────────────────────────────

function Step1({
  businessName, setBusinessName,
  industry, setIndustry,
  email, setEmail,
  onNext,
}: {
  businessName: string; setBusinessName: (v: string) => void;
  industry: string; setIndustry: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  onNext: () => void;
}) {
  const valid = businessName.trim().length >= 2 && industry && email.includes("@");

  return (
    <div>
      <div className="mb-7">
        <Label htmlFor="input-business-name" className="page-eyebrow mb-2.5 block">
          Business name
        </Label>
        <Input
          type="text"
          id="input-business-name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Apollo Hospital Chennai"
          autoFocus
        />
      </div>

      <div className="mb-7">
        <p className="page-eyebrow mb-2.5">Industry</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind.value}
              type="button"
              id={`industry-${ind.value.replace(/\s/g, "-").toLowerCase()}`}
              onClick={() => setIndustry(ind.value)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                industry === ind.value
                  ? "border-primary bg-primary/12 text-slate-100"
                  : "border-border bg-surface-2 text-slate-400 hover:border-white/15 hover:text-slate-200"
              }`}
            >
              <span className="text-primary-soft shrink-0" aria-hidden>
                {ind.icon}
              </span>
              <span className="text-xs font-medium">{ind.value}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-7">
        <Label htmlFor="input-email" className="page-eyebrow mb-2.5 block">
          Business email
        </Label>
        <Input
          type="email"
          id="input-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. feedback@company.com"
        />
      </div>

      <Button
        type="button"
        id="btn-next-step1"
        disabled={!valid}
        onClick={onNext}
        size="lg"
        className="w-full justify-center"
      >
        Continue →
      </Button>
    </div>
  );
}

// ─── Step 2: How you collect feedback + Workspace settings ───────────────────

function Step2({
  feedbackMethod, setFeedbackMethod,
  monthlyCustomers, setMonthlyCustomers,
  avgRevenue, setAvgRevenue,
  premiumPct, setPremiumPct,
  currency, setCurrency,
  onBack, onNext,
}: {
  feedbackMethod: string; setFeedbackMethod: (v: string) => void;
  monthlyCustomers: string; setMonthlyCustomers: (v: string) => void;
  avgRevenue: string; setAvgRevenue: (v: string) => void;
  premiumPct: string; setPremiumPct: (v: string) => void;
  currency: string; setCurrency: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div>
      {/* Feedback method */}
      <div className="mb-7">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
          How do you currently collect customer feedback?
        </label>
        <p className="text-[11px] text-slate-600 mb-3">
          QR / direct form collect new feedback. CSV covers existing surveys and exports.
        </p>
        <div className="flex flex-col gap-2">
          {FEEDBACK_METHODS.map(fm => (
            <button
              key={fm.value}
              type="button"
              id={`feedback-method-${fm.value}`}
              onClick={() => setFeedbackMethod(fm.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                feedbackMethod === fm.value
                  ? "border-primary bg-primary/10 text-slate-100"
                  : "border-border bg-surface-2 text-slate-400 hover:border-white/15"
              }`}
            >
              <span className="text-primary-soft shrink-0" aria-hidden>{fm.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-xs font-semibold ${feedbackMethod === fm.value ? "text-slate-100" : "text-slate-300"}`}>{fm.label}</p>
                  {fm.category === "A" && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Cat A</span>
                  )}
                  {fm.category === "B" && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">Cat B</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">{fm.desc}</p>
              </div>
              {feedbackMethod === fm.value && (
                <span className="ml-auto text-primary-soft text-sm" aria-hidden>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue settings */}
      <div className="mb-7 p-5 rounded-xl border border-white/6 bg-background">
        <div className="flex items-center gap-2 mb-4">
          <CircleDollarSign className="size-4 text-primary-soft shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold text-slate-200">Workspace revenue settings</p>
            <p className="text-[11px] text-slate-500">Powers the revenue impact algorithm. Estimates can be updated later.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Monthly Customers</label>
            <input
              type="number"
              id="input-monthly-customers"
              value={monthlyCustomers}
              onChange={e => setMonthlyCustomers(e.target.value)}
              placeholder="500"
              min="1"
              className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Avg Revenue / Customer</label>
            <div className="flex gap-1.5">
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="bg-surface-2 border border-white/8 rounded-lg px-2 py-2 text-xs text-slate-300 focus:outline-none focus:border-primary transition-colors"
              >
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input
                type="number"
                id="input-avg-revenue"
                value={avgRevenue}
                onChange={e => setAvgRevenue(e.target.value)}
                placeholder="500"
                min="0"
                className="flex-1 bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Premium / Paying Customers (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                id="input-premium-pct"
                value={premiumPct}
                onChange={e => setPremiumPct(e.target.value)}
                min="0" max="100" step="5"
                className="flex-1 accent-primary"
              />
              <span className="text-sm font-bold font-mono text-primary-soft w-12 text-right">{premiumPct}%</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Premium customers receive higher weight in priority scoring.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          id="btn-next-step2"
          disabled={!feedbackMethod}
          onClick={onNext}
          className="flex-1 justify-center"
        >
          Create Workspace →
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Workspace Created — Success Card ────────────────────────────────

function Step3Success({ biz }: { biz: BusinessResponse }) {
  return (
    <div>
      {/* Success banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 mb-6">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold shrink-0" aria-hidden>
          ✓
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-400">Workspace created</p>
          <p className="text-xs text-slate-400 mt-0.5">Save the links below — you&apos;ll need them to access your dashboard.</p>
        </div>
      </div>

      {/* Workspace card */}
      <div className="rounded-[18px] border border-white/[0.08] bg-background overflow-hidden mb-6">
        {/* Card header */}
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0" aria-hidden>
            AI
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">{biz.business_name}</p>
            <p className="text-[11px] text-slate-500">{biz.industry} · Workspace active</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>

        {/* Fields */}
        <div className="divide-y divide-white/5">
          {[
            { label: "Business ID",   value: biz.id,           mono: true  },
            { label: "Dashboard URL", value: biz.dashboard_url, mono: false },
            { label: "Feedback URL",  value: biz.feedback_url,  mono: false },
          ].map(field => (
            <div key={field.label} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-0.5">{field.label}</p>
                <p className={`text-xs truncate ${field.mono ? "font-mono text-slate-400" : "text-primary-soft"}`}>
                  {field.value}
                </p>
              </div>
              <CopyButton text={field.value} />
            </div>
          ))}
        </div>

        {/* QR Code — always shown when generated */}
        {biz.qr_code && (
          <div className="px-5 py-4 border-t border-white/6">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-3">QR Code — Feedback Collection</p>
            <div className="flex items-center gap-5">
              <div className="rounded-xl bg-white p-2.5 border border-white/10">
                <Image
                  src={biz.qr_code}
                  alt="Feedback QR Code"
                  width={90}
                  height={90}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Encodes your business-specific feedback URL. Customers scan to leave feedback instantly.
                </p>
                <a
                  id="btn-download-qr"
                  href={biz.qr_code}
                  download={`${biz.business_name.replace(/\s+/g, "_")}_QR.png`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold transition-colors w-fit"
                >
                  Download QR PNG
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reminder note */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
        <span className="text-amber-400 shrink-0 font-bold" aria-hidden>!</span>
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-amber-400">Bookmark your dashboard link.</span>{" "}
          There is no login system — your dashboard is accessible only via this URL. Save it now.
        </p>
      </div>

      {/* Go to Dashboard CTA */}
      <a
        id="btn-go-to-dashboard"
        href={biz.dashboard_url}
        className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(109,93,246,0.28)] hover:shadow-[0_6px_24px_rgba(109,93,246,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        Go to your workspace →
      </a>
    </div>
  );
}


// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RegisterPage() {
  // Step state
  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [created, setCreated] = useState<BusinessResponse | null>(null);

  // Step 1 fields
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry]         = useState("");
  const [email, setEmail]               = useState("");

  // Step 2 fields
  const [feedbackMethod, setFeedbackMethod]     = useState("none");
  const [monthlyCustomers, setMonthlyCustomers] = useState("500");
  const [avgRevenue, setAvgRevenue]             = useState("500");
  const [premiumPct, setPremiumPct]             = useState("20");
  const [currency, setCurrency]                 = useState("INR");

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const biz = await registerBusiness({
        business_name:       businessName.trim(),
        industry,
        email:               email.trim(),
        feedback_method:     feedbackMethod,
        monthly_customers:   parseInt(monthlyCustomers) || 500,
        avg_revenue_per_user: parseFloat(avgRevenue) || 500,
        premium_pct:         parseFloat(premiumPct) || 20,
        currency,
      });
      setCreated(biz);
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const STEP_LABELS = [
    { step: 1, label: "Business Info" },
    { step: 2, label: "Onboarding" },
    { step: 3, label: "Workspace Ready" },
  ];

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[15%] w-[700px] h-[700px] bg-primary/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-500/3 rounded-full blur-[110px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-xl px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-[10px] font-bold text-white shadow-[0_4px_14px_rgba(109,93,246,0.28)]" aria-hidden>
              AI
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-100">RoadmapAI</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5">
            {STEP_LABELS.map(({ step: s, label }) => (
              <StepBadge
                key={s}
                step={s}
                label={label}
                active={step === s}
                done={step > s}
              />
            )).reduce<ReactNode[]>((acc, el, i, arr) => {
              acc.push(el);
              if (i < arr.length - 1) acc.push(<span key={`sep-${i}`} className="w-6 h-px bg-white/10" />);
              return acc;
            }, [])}
          </div>
          <span className="text-xs text-slate-600 font-mono">Step {step} / 3</span>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-xl">

          {/* Header */}
          {step < 3 && (
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/25 bg-primary/10 text-xs font-semibold text-primary-soft-2 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {step === 1 ? "Create your workspace" : "Tailor your experience"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 mb-2">
                {step === 1 ? "Business Registration" : "How do you collect feedback?"}
              </h1>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                {step === 1
                  ? "Register your business to get a permanent dashboard URL, feedback form, and QR code."
                  : "This helps us show you the right onboarding flow. Your revenue settings power the Decision Score."
                }
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="text-center mb-8">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 mb-2">Your Workspace is Ready</h1>
              <p className="text-slate-400 text-sm">Save your Business ID and Dashboard URL before continuing.</p>
            </div>
          )}

          {/* Card */}
          <div className="rounded-[20px] border border-white/[0.08] bg-surface p-6 sm:p-7 shadow-[0_8px_28px_rgba(0,0,0,0.36)]">
            {error && (
              <div role="alert" className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-5">
                <span className="shrink-0 font-semibold" aria-hidden>!</span> {error}
              </div>
            )}

            {step === 1 && (
              <Step1
                businessName={businessName} setBusinessName={setBusinessName}
                industry={industry} setIndustry={setIndustry}
                email={email} setEmail={setEmail}
                onNext={() => { setError(null); setStep(2); }}
              />
            )}

            {step === 2 && (
              loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-[#6D5DF6] rounded-full animate-spin" aria-hidden />
                  <p className="text-sm text-slate-400">Creating your workspace…</p>
                  <p className="text-xs text-slate-600">Generating QR code and permanent URLs</p>
                </div>
              ) : (
                <Step2
                  feedbackMethod={feedbackMethod} setFeedbackMethod={setFeedbackMethod}
                  monthlyCustomers={monthlyCustomers} setMonthlyCustomers={setMonthlyCustomers}
                  avgRevenue={avgRevenue} setAvgRevenue={setAvgRevenue}
                  premiumPct={premiumPct} setPremiumPct={setPremiumPct}
                  currency={currency} setCurrency={setCurrency}
                  onBack={() => { setError(null); setStep(1); }}
                  onNext={handleSubmit}
                />
              )
            )}

            {step === 3 && created && <Step3Success biz={created} />}
          </div>

          <p className="text-center text-xs text-slate-600 mt-5">
            Already have a workspace?{" "}
            <Link href="/" className="text-primary-soft hover:text-primary-soft-2 transition-colors">Analyse feedback →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
