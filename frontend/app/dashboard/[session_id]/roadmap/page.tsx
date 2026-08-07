"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRoadmap } from "@/lib/api";
import { exportUrls } from "@/lib/api";
import type { RoadmapWeek } from "@/lib/types";

const EFFORT_COLORS: Record<string, string> = {
  "Quick Win": "var(--color-success)",
  "Medium":    "var(--color-warning)",
  "Large":     "#ef4444",
};

export default function RoadmapPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [roadmap, setRoadmap] = useState<RoadmapWeek[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRoadmap(sessionId)
      .then(r => setRoadmap(r.roadmap))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <nav className="nav">
        <div className="container" style={{ padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href={`/dashboard/${sessionId}`} className="btn btn-outline btn-sm" id="btn-back-from-roadmap">← Dashboard</Link>
            <span style={{ fontWeight: 700 }}>🗺️ Product Roadmap</span>
          </div>
          <a
            href={exportUrls.roadmap(sessionId)}
            download
            className="btn btn-outline btn-sm"
            id="btn-export-roadmap"
          >
            ⬇️ Export Markdown
          </a>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: 760 }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ marginBottom: "0.5rem" }}>6-Week Product Roadmap</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Evidence-backed plan generated from your customer reviews. Every theme links to real feedback.
          </p>
        </div>

        {/* Timeline */}
        <div style={{ position: "relative" }}>
          {roadmap.map((week, i) => (
            <div
              key={i}
              className="roadmap-week animate-fade-in"
              id={`roadmap-week-${week.week}`}
              style={{
                marginBottom: i === roadmap.length - 1 ? 0 : "2rem",
                animationDelay: `${i * 0.08}s`,
              }}
            >
              <div className="roadmap-dot" />

              <div className="card" style={{ marginLeft: "0.5rem" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.875rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>
                      Week {week.week}
                    </div>
                    <h3 style={{ fontSize: "1.1rem" }}>{week.theme}</h3>
                  </div>
                  <span style={{
                    padding: "0.3rem 0.75rem", borderRadius: 999,
                    fontSize: "0.75rem", fontWeight: 700,
                    background: `${EFFORT_COLORS[week.effort] || "var(--color-accent)"}20`,
                    color: EFFORT_COLORS[week.effort] || "var(--color-accent)",
                    border: `1px solid ${EFFORT_COLORS[week.effort] || "var(--color-accent)"}40`,
                    whiteSpace: "nowrap",
                  }}>
                    ⏱ {week.effort}
                  </span>
                </div>

                {/* Issues */}
                {week.issues.length > 0 && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                    {week.issues.map(key => (
                      <Link
                        key={key}
                        href={`/dashboard/${sessionId}/evidence/${key}`}
                        style={{
                          fontSize: "0.78rem", padding: "0.25rem 0.625rem",
                          background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                          borderRadius: 6, color: "var(--color-primary-glow)",
                          textDecoration: "none", fontFamily: "JetBrains Mono, monospace",
                          transition: "all 0.15s",
                        }}
                        id={`roadmap-issue-${key}`}
                      >
                        {key}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Rationale */}
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  {week.rationale}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", gap: "1rem", marginTop: "3rem", flexWrap: "wrap" }}>
          <Link href={`/dashboard/${sessionId}/sprint`} className="btn btn-primary" id="btn-to-sprint">
            ⚡ View Sprint Plan →
          </Link>
          <Link href={`/dashboard/${sessionId}/meeting`} className="btn btn-outline" id="btn-to-meeting">
            🎤 Discuss with AI
          </Link>
        </div>
      </div>
    </main>
  );
}
