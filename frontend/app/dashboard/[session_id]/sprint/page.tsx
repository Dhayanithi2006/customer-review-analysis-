"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSprint, exportUrls } from "@/lib/api";
import type { Sprint } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { StoryCard } from "@/components/sprint/StoryCard";
import { SkeletonSprint } from "@/components/sprint/SkeletonSprint";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";

const PRIORITY_GROUPS = [
  { label: "🔴 High Priority",   key: "High"   as const },
  { label: "🟡 Medium Priority", key: "Medium" as const },
  { label: "🟢 Low Priority",    key: "Low"    as const },
];

export default function SprintPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [sprint, setSprint]   = useState<Sprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getSprint(sessionId)
      .then(r => setSprint(r.sprint))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="min-h-screen bg-[#08090e]">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title={sprint?.name || "Sprint Plan"}
        sessionId={sessionId}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/roadmap`}>🗺️ Roadmap</Link>
            </Button>
            <Button asChild size="sm">
              <a href={exportUrls.sprint(sessionId)} download id="btn-export-sprint">
                ⬇️ Export Jira CSV
              </a>
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-screen-md px-6 py-8">
        {loading ? (
          <SkeletonSprint />
        ) : sprint ? (
          <>
            {/* ── Sprint header ── */}
            <div className="mb-8 animate-fade-in">
              <h1 className="text-3xl font-black text-slate-100 mb-2">⚡ {sprint.name}</h1>
              <p className="text-slate-400 text-sm">Jira-ready user stories with acceptance criteria, generated from your top-priority customer issues.</p>
            </div>

            {/* ── Sprint Metrics ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-fade-in" style={{ animationDelay: "0.08s" }}>
              <MetricCard label="Owner"         value={sprint.owner}                             icon="👤" />
              <MetricCard label="Duration"      value={`${sprint.duration_weeks}w`}              icon="📅" />
              <MetricCard label="Story Points"  value={String(sprint.total_story_points)}        accentColor="#818cf8" icon="⚡" />
              <MetricCard label="Stories"       value={String(sprint.stories.length)}            icon="📋" />
            </div>

            {/* ── Stories by priority ── */}
            {PRIORITY_GROUPS.map(group => {
              const stories = sprint.stories.filter(s => s.priority === group.key);
              if (stories.length === 0) return null;
              return (
                <div key={group.key} className="mb-8 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-base font-bold text-slate-200">{group.label}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#161827] border border-white/10 text-slate-500">
                      {stories.length} stories · {stories.reduce((a, s) => a + (s.story_points || 0), 0)} pts
                    </span>
                  </div>
                  <div className="space-y-3">
                    {stories.map(story => (
                      <StoryCard key={story.id} story={story} sessionId={sessionId} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ── Actions ── */}
            <div className="flex gap-3 mt-4 flex-wrap border-t border-white/7 pt-6">
              <Button asChild>
                <a href={exportUrls.sprint(sessionId)} download>
                  ⬇️ Export to Jira CSV
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/${sessionId}/export`}>📄 Full Export →</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/${sessionId}/meeting`}>🎤 Discuss with AI</Link>
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
