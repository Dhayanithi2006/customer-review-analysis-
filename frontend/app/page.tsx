"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadCSV } from "@/lib/api";
import { Button } from "@/components/ui/button";

const SOURCES = [
  { id: "play_store", label: "Play Store",  emoji: "🤖" },
  { id: "app_store",  label: "App Store",   emoji: "🍎" },
  { id: "support",    label: "Support",     emoji: "🎧" },
  { id: "twitter",    label: "Twitter/X",   emoji: "𝕏"  },
  { id: "reddit",     label: "Reddit",      emoji: "👾" },
];

const TEAM_SIZES = [
  { id: "solo",      label: "Solo Founder" },
  { id: "2_5",       label: "2–5 People"  },
  { id: "5_10_plus", label: "5–10+"       },
];

const PIPELINE_STEPS = [
  { icon: "📥", label: "Upload CSV",       desc: "Any format. Auto-detected." },
  { icon: "🧹", label: "Clean & Filter",   desc: "Spam, dupes removed." },
  { icon: "💬", label: "VADER Sentiment",  desc: "Routes actionable reviews." },
  { icon: "🤖", label: "Gemini AI",        desc: "Categorises & clusters." },
  { icon: "📊", label: "Priority Engine",  desc: "Scores every issue." },
  { icon: "🗺️", label: "Roadmap + Sprint", desc: "6 weeks. Jira-ready." },
  { icon: "🎤", label: "AI Meeting",       desc: "Ask anything. Get answers." },
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile]         = useState<File | null>(null);
  const [source, setSource]     = useState("play_store");
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
    if (!file) { setError("Please select a CSV file."); return; }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadCSV(file, source, teamSize);
      router.push(`/dashboard/${result.session_id}/processing`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090e] text-slate-100 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-indigo-500/8 rounded-full blur-[120px] animate-glow" />
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-500/6 rounded-full blur-[100px] animate-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-[20%] left-[30%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[130px] animate-glow" style={{ animationDelay: "2s" }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-white/7 bg-[#08090e]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-xl px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm shadow-[0_0_16px_rgba(99,102,241,0.5)]">
              🗺️
            </div>
            <span className="font-black text-base tracking-tight">RoadmapAI</span>
          </div>
          <span className="text-xs text-slate-500 font-mono hidden sm:block">From Customer Voice to Product Decisions</span>
        </div>
      </nav>

      <div className="mx-auto max-w-screen-xl px-6">
        {/* ── Hero ── */}
        <div className="text-center pt-20 pb-16 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-semibold text-indigo-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ✨ AI Product Intelligence Platform
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Turn{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">
              2,000 reviews
            </span>
            <br />
            into a sprint plan
            <br className="hidden sm:block" /> in 3 minutes
          </h1>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Upload your customer feedback. RoadmapAI tells you exactly what to build next —
            with evidence, priority scores, and Jira-ready stories.
          </p>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-6 flex-wrap mb-16">
            {[
              { icon: "🔒", text: "Reviews never stored raw" },
              { icon: "⚡", text: "Results in ~3 minutes" },
              { icon: "📋", text: "Jira-ready sprint" },
              { icon: "🎯", text: "Evidence-backed decisions" },
            ].map(t => (
              <div key={t.text} className="flex items-center gap-2 text-sm text-slate-500">
                <span>{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Upload Card ── */}
        <div className="max-w-2xl mx-auto pb-20 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <div className="rounded-2xl border border-white/10 bg-[#0f111a] shadow-[0_0_80px_rgba(99,102,241,0.08)] p-8">
            {/* Step 1: Source */}
            <div className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Step 1 — Review Source
              </p>
              <div className="flex gap-2 flex-wrap">
                {SOURCES.map(s => (
                  <button
                    key={s.id}
                    id={`source-${s.id}`}
                    onClick={() => setSource(s.id)}
                    className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-150 min-w-[76px] ${
                      source === s.id
                        ? "border-indigo-500 bg-indigo-500/12 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]"
                        : "border-white/7 bg-[#161827] hover:border-white/15"
                    }`}
                  >
                    <span className="text-2xl">{s.emoji}</span>
                    <span className={`text-[11px] font-semibold ${source === s.id ? "text-slate-100" : "text-slate-400"}`}>
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Team Size */}
            <div className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Step 2 — Team Size
              </p>
              <div className="flex gap-2">
                {TEAM_SIZES.map(t => (
                  <button
                    key={t.id}
                    id={`team-${t.id}`}
                    onClick={() => setTeamSize(t.id)}
                    className={`flex-1 py-2.5 px-3 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-all duration-150 ${
                      teamSize === t.id
                        ? "border-indigo-500 bg-indigo-500/12 text-slate-100"
                        : "border-white/7 bg-[#161827] text-slate-400 hover:border-white/15"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: File Upload */}
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Step 3 — Upload CSV
              </p>

              <div
                id="upload-dropzone"
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? "border-indigo-500 bg-indigo-500/8 shadow-[0_0_40px_rgba(99,102,241,0.15)]"
                    : file
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-white/10 bg-[#0f111a] hover:border-indigo-500/40 hover:bg-indigo-500/5"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div>
                    <div className="text-4xl mb-3">✅</div>
                    <p className="font-bold text-slate-100 mb-1">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-5xl mb-4 animate-float">📂</div>
                    <p className="font-semibold text-slate-200 mb-1">Drop your CSV here</p>
                    <p className="text-sm text-slate-500">or click to browse · max 50 MB · up to 10,000 reviews</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 mt-3 text-center">
                💡 Any CSV with a review/text column works. Column names are auto-detected.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-4">
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <Button
              id="btn-analyze"
              onClick={handleSubmit}
              disabled={uploading || !file}
              size="lg"
              className="w-full justify-center"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>🚀 Analyse My Reviews</>
              )}
            </Button>
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How it works</h2>
            <p className="text-slate-400">7 steps. 3 minutes. Zero data science.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-white/7 bg-[#0f111a] p-4 text-center transition-all duration-200 hover:border-indigo-500/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(99,102,241,0.1)] animate-fade-in"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="text-3xl mb-2 transition-transform duration-200 group-hover:scale-110">{step.icon}</div>
                <div className="font-bold text-xs text-slate-200 mb-1">{step.label}</div>
                <div className="text-[11px] text-slate-500">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Feature highlights ── */}
        <div className="pb-24 border-t border-white/7 pt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Built for product teams that move fast</h2>
            <p className="text-slate-400">Everything you need to go from raw reviews to shipped features.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "🧠",
                title: "AI-Powered Clustering",
                desc: "Gemini groups thousands of reviews into actionable issue clusters — automatically.",
                gradient: "from-indigo-500/20 to-purple-500/10",
              },
              {
                icon: "📊",
                title: "Revenue Impact Scoring",
                desc: "Every issue is weighted by premium user count, severity, and review volume.",
                gradient: "from-cyan-500/20 to-indigo-500/10",
              },
              {
                icon: "⚡",
                title: "Jira-Ready Sprint Plans",
                desc: "User stories, acceptance criteria, and story points — ready to import.",
                gradient: "from-amber-500/15 to-orange-500/10",
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`rounded-2xl border border-white/7 bg-gradient-to-br ${f.gradient} p-6 transition-all duration-200 hover:border-white/15 hover:-translate-y-1`}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-slate-100 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/7 py-8 text-center text-xs text-slate-600">
        RoadmapAI · AI Product Intelligence Platform · Built for Hacklab
      </div>
    </div>
  );
}
