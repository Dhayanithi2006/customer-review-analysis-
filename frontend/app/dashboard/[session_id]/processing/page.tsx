"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPipelineStatus } from "@/lib/api";

const STEPS = [
  { step: 1, label: "Removing duplicates & spam",          icon: "🧹" },
  { step: 2, label: "Running sentiment analysis (VADER)",   icon: "💬" },
  { step: 3, label: "AI categorisation (Gemini)",           icon: "🤖" },
  { step: 4, label: "Clustering related issues",            icon: "🔗" },
  { step: 5, label: "Calculating priority scores",          icon: "📊" },
  { step: 6, label: "Generating executive summary",         icon: "📝" },
  { step: 7, label: "Building roadmap & sprint plan",       icon: "🗺️" },
];

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const [status, setStatus] = useState({ step: 0, progress: 5, processed: 0, total: 0, message: "" });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await getPipelineStatus(sessionId);
        setStatus(s);
        if (s.status === "complete") {
          clearInterval(interval);
          setTimeout(() => router.push(`/dashboard/${sessionId}`), 800);
        }
        if (s.status === "failed") {
          clearInterval(interval);
          setFailed(true);
        }
      } catch { /* network blip — keep polling */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [sessionId, router]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 560, width: "100%", padding: "2rem" }} className="animate-fade-in">
        <div className="card" style={{ padding: "2.5rem" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
              {failed ? "❌" : status.step >= 7 ? "✅" : "⚙️"}
            </div>
            <h2 style={{ marginBottom: "0.5rem" }}>
              {failed ? "Analysis failed" : status.step >= 7 ? "Analysis complete!" : "Analysing your reviews…"}
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
              {failed
                ? status.message || "An error occurred. Please try again."
                : `${status.processed.toLocaleString()} of ${status.total.toLocaleString()} reviews processed`}
            </p>
          </div>

          {/* Progress bar */}
          {!failed && (
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Progress</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "var(--color-primary-glow)" }}>
                  {status.progress}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${status.progress}%` }} />
              </div>
            </div>
          )}

          {/* Step list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {STEPS.map(s => {
              const done    = s.step < status.step;
              const current = s.step === status.step;
              return (
                <div key={s.step} style={{
                  display: "flex", alignItems: "center", gap: "0.875rem",
                  padding: "0.75rem 1rem",
                  background: current ? "rgba(99,102,241,0.08)" : "transparent",
                  border: `1px solid ${current ? "rgba(99,102,241,0.25)" : "transparent"}`,
                  borderRadius: "var(--radius-md)",
                  opacity: s.step > status.step ? 0.35 : 1,
                  transition: "all 0.3s ease",
                }}>
                  <div style={{ fontSize: "1.1rem", width: 24, textAlign: "center" }}>
                    {done ? "✅" : current ? <span style={{ fontSize: "1rem" }}>{s.icon}</span> : s.icon}
                  </div>
                  <span style={{
                    fontSize: "0.875rem",
                    fontWeight: current ? 600 : 400,
                    color: done ? "var(--color-success)" : current ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  }}>
                    {s.label}
                  </span>
                  {current && (
                    <span className="spinner" style={{ marginLeft: "auto", width: 14, height: 14 }} />
                  )}
                </div>
              );
            })}
          </div>

          {failed && (
            <button
              className="btn btn-outline"
              onClick={() => window.history.back()}
              style={{ width: "100%", justifyContent: "center", marginTop: "1.5rem" }}
            >
              ← Try again
            </button>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "1rem" }}>
          ☕ This usually takes 2–4 minutes for 1,000 reviews.
        </p>
      </div>
    </main>
  );
}
