"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDashboard } from "@/lib/api";
import type { DashboardData, IssueCluster } from "@/lib/types";

const CATEGORY_BADGE: Record<string, string> = {
  "Bug":              "badge-bug",
  "Performance":      "badge-perf",
  "UX":               "badge-ux",
  "Feature Request":  "badge-feature",
  "Praise":           "badge-praise",
  "Pricing":          "badge-pricing",
};

function CategoryBadge({ cat }: { cat: string }) {
  return (
    <span className={`badge ${CATEGORY_BADGE[cat] || "badge-default"}`}>
      {cat}
    </span>
  );
}

function MetricCard({
  label, value, sub, accent, id
}: { label: string; value: string; sub?: string; accent?: string; id: string }) {
  return (
    <div className="metric-card" id={id}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: accent || "var(--color-text-primary)", marginTop: "0.5rem" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>{sub}</div>}
    </div>
  );
}

function PriorityItem({ cluster, sessionId, rank }: { cluster: IssueCluster; sessionId: string; rank: number }) {
  return (
    <Link
      href={`/dashboard/${sessionId}/evidence/${cluster.issue_key}`}
      className="priority-item"
      id={`priority-${cluster.issue_key}`}
    >
      <span className="priority-rank">#{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {cluster.issue_key.replace(/_/g, " ")}
          </span>
          <CategoryBadge cat={cluster.category} />
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <span>📊 {cluster.review_count} reviews</span>
          {cluster.revenue_at_risk > 0 && (
            <span className="revenue-risk">₹{(cluster.revenue_at_risk / 1000).toFixed(0)}K at risk</span>
          )}
          {cluster.premium_user_count > 0 && (
            <span style={{ color: "var(--color-accent)" }}>⭐ {cluster.premium_user_count} premium</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: "0.75rem", fontFamily: "JetBrains Mono, monospace",
            color: "var(--color-primary-glow)", fontWeight: 700
          }}>
            {(cluster.priority_score * 100).toFixed(0)}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>score</div>
        </div>
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>→</span>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    getDashboard(sessionId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <div style={{ textAlign: "center" }}>
        <span className="spinner" style={{ width: 40, height: 40 }} />
        <p style={{ marginTop: "1rem", color: "var(--color-text-muted)" }}>Loading dashboard…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <div className="card" style={{ maxWidth: 400, textAlign: "center", padding: "2rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
        <h3>Something went wrong</h3>
        <p style={{ color: "var(--color-text-muted)", marginTop: "0.5rem", fontSize: "0.9rem" }}>{error}</p>
      </div>
    </div>
  );

  if (!data) return null;

  const filteredIssues = filter === "All"
    ? data.issues
    : data.issues.filter(i => i.category === filter);

  const categories = ["All", ...Array.from(new Set(data.issues.map(i => i.category)))];
  const totalRevenueAtRisk = data.revenue_at_risk;

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* ── Nav ── */}
      <nav className="nav">
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem" }}>🗺️</div>
              <span style={{ fontWeight: 800, fontSize: "1rem" }}>RoadmapAI</span>
            </Link>
            <span style={{ color: "var(--color-border)", fontSize: "1.2rem" }}>·</span>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
              {sessionId.slice(0, 8)}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link href={`/dashboard/${sessionId}/meeting`} className="btn btn-outline btn-sm" id="btn-nav-meeting">🎤 AI Meeting</Link>
            <Link href={`/dashboard/${sessionId}/roadmap`} className="btn btn-outline btn-sm" id="btn-nav-roadmap">🗺️ Roadmap</Link>
            <Link href={`/dashboard/${sessionId}/sprint`}  className="btn btn-outline btn-sm" id="btn-nav-sprint">⚡ Sprint</Link>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        {/* ── AI Recommendation Banner ── */}
        {data.ai_recommendation && (
          <div style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08))",
            border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: "var(--radius-lg)", padding: "1rem 1.5rem",
            marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem",
          }} className="animate-fade-in">
            <div style={{ fontSize: "1.5rem" }}>🤖</div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-primary-glow)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>
                AI Recommendation
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{data.ai_recommendation}</div>
            </div>
          </div>
        )}

        {/* ── Headline Insights ── */}
        {data.headline_insights.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {data.headline_insights.map((insight, i) => (
              <div key={i} style={{
                background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)", padding: "0.875rem 1.25rem",
                fontSize: "0.875rem", color: "var(--color-text-secondary)",
                display: "flex", gap: "0.625rem", alignItems: "flex-start",
              }}>
                <span style={{ color: "var(--color-primary-glow)" }}>◈</span>
                {insight}
              </div>
            ))}
          </div>
        )}

        {/* ── Metric Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <MetricCard
            id="metric-revenue"
            label="Revenue at Risk"
            value={`₹${(totalRevenueAtRisk / 1000).toFixed(1)}K`}
            sub="Estimated from affected premium users"
            accent="#ef4444"
          />
          <MetricCard
            id="metric-top"
            label="Highest Priority Issue"
            value={data.top_priority_issue?.issue_key.replace(/_/g, " ") || "—"}
            sub={data.top_priority_issue ? `${data.top_priority_issue.review_count} reviews` : ""}
            accent="var(--color-text-primary)"
          />
          <MetricCard
            id="metric-feature"
            label="Most Requested Feature"
            value={data.most_requested_feature?.issue_key.replace(/_/g, " ") || "—"}
            sub={data.most_requested_feature ? `${data.most_requested_feature.review_count} mentions` : ""}
            accent="var(--color-accent)"
          />
          <MetricCard
            id="metric-reviews"
            label="Reviews Analysed"
            value={data.actionable_reviews.toLocaleString()}
            sub={`of ${data.total_reviews.toLocaleString()} total`}
            accent="var(--color-primary-glow)"
          />
        </div>

        {/* ── Executive Summary ── */}
        {data.executive_summary && (
          <div className="card" style={{ marginBottom: "2rem" }}>
            <button
              onClick={() => setSummaryOpen(o => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              id="btn-toggle-summary"
            >
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>📋 Executive Summary</span>
              <span style={{ fontSize: "1.2rem", color: "var(--color-text-muted)", transform: summaryOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {summaryOpen && (
              <div style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--color-text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {data.executive_summary}
              </div>
            )}
          </div>
        )}

        {/* ── Priority List ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <h3>Priority Issues</h3>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  id={`filter-${cat.replace(/\s/g, "-")}`}
                  style={{
                    padding: "0.3rem 0.75rem", borderRadius: 999,
                    border: `1px solid ${filter === cat ? "var(--color-primary)" : "var(--color-border)"}`,
                    background: filter === cat ? "rgba(99,102,241,0.15)" : "transparent",
                    color: filter === cat ? "var(--color-text-primary)" : "var(--color-text-muted)",
                    cursor: "pointer", fontSize: "0.78rem", fontWeight: 600,
                    transition: "all var(--transition-fast)",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {filteredIssues.map((cluster, i) => (
              <PriorityItem key={cluster.id} cluster={cluster} sessionId={sessionId} rank={cluster.priority_rank || i + 1} />
            ))}
          </div>
        </div>

        {/* ── CTA Row ── */}
        <div style={{ display: "flex", gap: "1rem", marginTop: "2.5rem", flexWrap: "wrap" }}>
          <Link href={`/dashboard/${sessionId}/meeting`} className="btn btn-primary btn-lg" id="btn-start-meeting">
            🎤 Start AI Review Meeting
          </Link>
          <Link href={`/dashboard/${sessionId}/roadmap`} className="btn btn-outline btn-lg" id="btn-view-roadmap">
            🗺️ View Roadmap
          </Link>
          <Link href={`/dashboard/${sessionId}/sprint`} className="btn btn-outline btn-lg" id="btn-view-sprint">
            ⚡ View Sprint
          </Link>
        </div>
      </div>
    </main>
  );
}
