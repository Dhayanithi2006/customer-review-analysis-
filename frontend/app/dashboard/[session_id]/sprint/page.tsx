"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSprint, exportUrls } from "@/lib/api";
import type { Sprint, SprintStory } from "@/lib/types";

const PRIORITY_COLORS = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };
const EFFORT_LABELS   = { S: "2pts · Small", M: "5pts · Medium", L: "8pts · Large" };

function StoryCard({ story, sessionId }: { story: SprintStory; sessionId: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sprint-card" id={`story-${story.id}`}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.625rem" }}>
        <div style={{ flexShrink: 0, marginTop: "0.15rem" }}>
          <span style={{
            display: "inline-block", width: 10, height: 10, borderRadius: "50%",
            background: PRIORITY_COLORS[story.priority] || "#94a3b8",
            boxShadow: `0 0 6px ${PRIORITY_COLORS[story.priority] || "#94a3b8"}`,
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              {story.id}
            </span>
            <span style={{
              fontSize: "0.7rem", padding: "0.1rem 0.4rem",
              background: "var(--color-surface-3)", borderRadius: 4,
              color: "var(--color-text-muted)",
            }}>
              {EFFORT_LABELS[story.effort] || story.effort}
            </span>
          </div>
          <h4 style={{ fontSize: "0.925rem", lineHeight: 1.3 }}>{story.title}</h4>
        </div>
        <button
          onClick={() => setExpanded(o => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "1.1rem", flexShrink: 0, padding: "0.25rem" }}
          id={`toggle-${story.id}`}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* User story */}
      <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginLeft: "1.625rem", fontStyle: "italic" }}>
        {story.user_story}
      </p>

      {/* Expanded: acceptance criteria */}
      {expanded && (
        <div style={{ marginTop: "0.875rem", marginLeft: "1.625rem" }} className="animate-fade-in">
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
            Acceptance Criteria
          </div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {story.acceptance_criteria.map((ac, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                <span style={{ color: "var(--color-success)", flexShrink: 0 }}>✓</span>
                {ac}
              </li>
            ))}
          </ul>

          {/* Link to evidence */}
          <Link
            href={`/dashboard/${sessionId}/evidence/${story.linked_issue}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--color-primary-glow)", textDecoration: "none" }}
            id={`evidence-link-${story.id}`}
          >
            📎 View evidence for {story.linked_issue} →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function SprintPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [sprint, setSprint]   = useState<Sprint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSprint(sessionId)
      .then(r => setSprint(r.sprint))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  if (!sprint) return null;

  const highPriority   = sprint.stories.filter(s => s.priority === "High");
  const mediumPriority = sprint.stories.filter(s => s.priority === "Medium");
  const lowPriority    = sprint.stories.filter(s => s.priority === "Low");

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <nav className="nav">
        <div className="container" style={{ padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href={`/dashboard/${sessionId}`} className="btn btn-outline btn-sm" id="btn-back-from-sprint">← Dashboard</Link>
            <span style={{ fontWeight: 700 }}>⚡ {sprint.name}</span>
          </div>
          <a
            href={exportUrls.sprint(sessionId)}
            download
            className="btn btn-primary btn-sm"
            id="btn-export-sprint"
          >
            ⬇️ Export to Jira CSV
          </a>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: 800 }}>
        {/* Sprint header */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          {[
            { label: "Sprint",          value: sprint.name },
            { label: "Owner",           value: sprint.owner },
            { label: "Duration",        value: `${sprint.duration_weeks} weeks` },
            { label: "Story Points",    value: String(sprint.total_story_points) },
            { label: "Stories",         value: String(sprint.stories.length) },
          ].map(m => (
            <div key={m.label} style={{
              background: "var(--color-surface)", border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)", padding: "0.75rem 1.25rem",
            }}>
              <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", marginTop: "0.25rem" }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Stories grouped by priority */}
        {[
          { label: "🔴 High Priority", stories: highPriority },
          { label: "🟡 Medium Priority", stories: mediumPriority },
          { label: "🟢 Low Priority",  stories: lowPriority },
        ].filter(g => g.stories.length > 0).map(group => (
          <div key={group.label} style={{ marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "0.875rem", fontSize: "1rem" }}>{group.label}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {group.stories.map(story => (
                <StoryCard key={story.id} story={story} sessionId={sessionId} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
