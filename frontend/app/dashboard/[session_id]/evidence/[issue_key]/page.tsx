"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getEvidence } from "@/lib/api";
import type { EvidenceData } from "@/lib/types";

const SEVERITY_COLOR = (s: number) =>
  s >= 8 ? "#ef4444" : s >= 5 ? "#f59e0b" : "#10b981";

export default function EvidencePage() {
  const params    = useParams();
  const sessionId = params.session_id as string;
  const issueKey  = params.issue_key as string;

  const [data, setData]       = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvidence(sessionId, issueKey)
      .then(setData)
      .finally(() => setLoading(false));
  }, [sessionId, issueKey]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  if (!data) return null;

  const badgeClass: Record<string, string> = {
    "Bug": "badge-bug", "Performance": "badge-perf", "UX": "badge-ux",
    "Feature Request": "badge-feature", "Praise": "badge-praise", "Pricing": "badge-pricing",
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <nav className="nav">
        <div className="container" style={{ padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href={`/dashboard/${sessionId}`} className="btn btn-outline btn-sm" id="btn-back-dashboard">← Dashboard</Link>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>Evidence Panel</span>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: 800 }}>
        {/* ── Header ── */}
        <div className="animate-fade-in" style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <span className={`badge ${badgeClass[data.category] || "badge-default"}`}>{data.category}</span>
            <span className="badge badge-default">{data.business_area}</span>
            {data.priority_rank && (
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                Priority #{data.priority_rank}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
            {issueKey.replace(/_/g, " ")}
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem" }}>{data.description}</p>
        </div>

        {/* ── Stats Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Confidence",      value: `${data.confidence}%`,                  accent: data.confidence >= 80 ? "var(--color-success)" : "var(--color-warning)" },
            { label: "Evidence",        value: `${data.review_count} reviews`,          accent: "var(--color-text-primary)" },
            { label: "Premium Users",   value: `${data.premium_user_count} affected`,   accent: "var(--color-accent)" },
            { label: "Avg Severity",    value: `${data.avg_severity?.toFixed(1)}/10`,   accent: SEVERITY_COLOR(data.avg_severity || 5) },
            { label: "Revenue at Risk", value: `₹${((data.revenue_at_risk || 0)/1000).toFixed(1)}K`, accent: "#ef4444" },
          ].map(s => (
            <div key={s.label} className="metric-card">
              <div className="metric-label">{s.label}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: s.accent, marginTop: "0.4rem", letterSpacing: "-0.02em" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Platforms ── */}
        {data.platforms.length > 0 && (
          <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontWeight: 600 }}>Sources:</span>
            {data.platforms.map(p => (
              <span key={p} className="badge badge-default">
                {p.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}

        <div className="divider" />

        {/* ── Sample Reviews ── */}
        <div>
          <h3 style={{ marginBottom: "1rem" }}>Sample Reviews</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {data.sample_reviews.length > 0 ? data.sample_reviews.map((review, i) => (
              <div key={i} className="review-quote" id={`review-${i}`}>
                "{review}"
              </div>
            )) : (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>No sample reviews available.</p>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" }}>
          <Link href={`/dashboard/${sessionId}/roadmap`} className="btn btn-primary" id="btn-view-in-roadmap">
            🗺️ View in Roadmap
          </Link>
          <Link href={`/dashboard/${sessionId}/meeting`} className="btn btn-outline" id="btn-ask-about-issue">
            🎤 Ask AI about this issue
          </Link>
        </div>
      </div>
    </main>
  );
}
