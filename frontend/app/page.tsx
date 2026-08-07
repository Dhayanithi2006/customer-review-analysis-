"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadCSV } from "@/lib/api";

const SOURCES = [
  { id: "play_store",  label: "Play Store",  emoji: "🤖" },
  { id: "app_store",   label: "App Store",   emoji: "🍎" },
  { id: "support",     label: "Support",     emoji: "🎧" },
  { id: "twitter",     label: "Twitter/X",   emoji: "𝕏"  },
  { id: "reddit",      label: "Reddit",      emoji: "👾" },
];

const TEAM_SIZES = [
  { id: "solo",      label: "Solo Founder" },
  { id: "2_5",       label: "2–5 People"  },
  { id: "5_10_plus", label: "5–10+"       },
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile]           = useState<File | null>(null);
  const [source, setSource]       = useState("play_store");
  const [teamSize, setTeamSize]   = useState("2_5");
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

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
    <main style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* ── Nav ── */}
      <nav className="nav">
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--gradient-brand)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem"
            }}>🗺️</div>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>RoadmapAI</span>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            From Customer Voice to Product Decisions
          </span>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "6rem" }}>
        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }} className="animate-fade-in">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: 999, padding: "0.375rem 1rem",
            fontSize: "0.8rem", color: "var(--color-primary-glow)",
            fontWeight: 600, marginBottom: "1.5rem",
          }}>
            <span>✨</span> AI Product Intelligence Platform
          </div>
          <h1 style={{ marginBottom: "1rem" }}>
            Turn <span className="text-gradient">2,000 reviews</span> into<br />
            a sprint plan in 3 minutes
          </h1>
          <p style={{ fontSize: "1.15rem", color: "var(--color-text-secondary)", maxWidth: 520, margin: "0 auto 2rem" }}>
            Upload your customer feedback. RoadmapAI tells you exactly what to build next — with evidence, priority scores, and Jira-ready stories.
          </p>
        </div>

        {/* ── Upload Card ── */}
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div className="card" style={{ padding: "2rem" }}>
            {/* Step 1: Source */}
            <div style={{ marginBottom: "1.75rem" }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                Step 1 — Review Source
              </p>
              <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
                {SOURCES.map(s => (
                  <button
                    key={s.id}
                    className={`source-btn ${source === s.id ? "selected" : ""}`}
                    onClick={() => setSource(s.id)}
                    id={`source-${s.id}`}
                  >
                    <span style={{ fontSize: "1.5rem" }}>{s.emoji}</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: source === s.id ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Team Size */}
            <div style={{ marginBottom: "1.75rem" }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                Step 2 — Team Size
              </p>
              <div style={{ display: "flex", gap: "0.625rem" }}>
                {TEAM_SIZES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTeamSize(t.id)}
                    id={`team-${t.id}`}
                    style={{
                      flex: 1, padding: "0.625rem",
                      background: teamSize === t.id ? "rgba(99,102,241,0.15)" : "var(--color-surface-2)",
                      border: `2px solid ${teamSize === t.id ? "var(--color-primary)" : "var(--color-border)"}`,
                      borderRadius: "var(--radius-md)", cursor: "pointer",
                      fontSize: "0.82rem", fontWeight: 600,
                      color: teamSize === t.id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: File Upload */}
            <div style={{ marginBottom: "1.75rem" }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                Step 3 — Upload CSV
              </p>
              <div
                className={`upload-zone ${dragOver ? "drag-over" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                id="upload-dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
                    <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{file.name}</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                      {(file.size / 1024).toFixed(0)} KB · Click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📂</div>
                    <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Drop your CSV here</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                      or click to browse · max 50 MB · up to 10,000 reviews
                    </p>
                  </div>
                )}
              </div>

              {/* Format hint */}
              <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "0.75rem", textAlign: "center" }}>
                💡 Any CSV with a review/text column works. Column names are auto-detected.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "var(--radius-md)", padding: "0.75rem 1rem",
                color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem",
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={uploading || !file}
              id="btn-analyze"
              style={{
                width: "100%", justifyContent: "center",
                opacity: uploading || !file ? 0.6 : 1,
                cursor: uploading || !file ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? (
                <><span className="spinner" style={{ width: 18, height: 18 }} /> Uploading…</>
              ) : (
                <>🚀 Analyse My Reviews</>
              )}
            </button>
          </div>

          {/* ── Trust signals ── */}
          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", marginTop: "2rem", flexWrap: "wrap" }}>
            {["🔒 Reviews never stored raw", "⚡ Results in ~3 minutes", "📋 Jira-ready sprint"].map(t => (
              <span key={t} style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <div style={{ marginTop: "6rem", textAlign: "center" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>How it works</h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "3rem" }}>7 steps. 3 minutes. Zero data science.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            {[
              { icon: "📥", label: "Upload CSV",         desc: "Any format. Auto-detected." },
              { icon: "🧹", label: "Clean & Filter",     desc: "Spam, dupes removed." },
              { icon: "💬", label: "VADER Sentiment",    desc: "Routes actionable reviews." },
              { icon: "🤖", label: "Gemini AI",          desc: "Categorises & clusters." },
              { icon: "📊", label: "Priority Engine",    desc: "Scores every issue." },
              { icon: "🗺️", label: "Roadmap + Sprint",   desc: "6 weeks. Jira-ready." },
              { icon: "🎤", label: "AI Meeting",         desc: "Ask anything. Get answers." },
            ].map((step, i) => (
              <div key={i} className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{step.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{step.label}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
