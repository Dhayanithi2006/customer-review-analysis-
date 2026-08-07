"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { User, Calendar, Zap, ListTodo } from "lucide-react";
import { getSprint, exportUrls } from "@/lib/api";
import type { Sprint } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { StoryCard } from "@/components/sprint/StoryCard";
import { SkeletonSprint } from "@/components/sprint/SkeletonSprint";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/MetricCard";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

const PRIORITY_GROUPS = [
  { label: "High priority", key: "High" as const, dot: "bg-red-400" },
  { label: "Medium priority", key: "Medium" as const, dot: "bg-amber-400" },
  { label: "Low priority", key: "Low" as const, dot: "bg-emerald-400" },
];

export default function SprintPage() {
  const params = useParams();
  const sessionId = params.session_id as string;

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getSprint(sessionId)
      .then((r) => setSprint(r.sprint))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title={sprint?.name || "Sprint plan"}
        sessionId={sessionId}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/roadmap`}>Roadmap</Link>
            </Button>
            <Button asChild size="sm">
              <a href={exportUrls.sprint(sessionId)} download id="btn-export-sprint">
                Export Jira CSV
              </a>
            </Button>
          </div>
        }
      />

      <WorkspacePage width="narrow">
        {loading ? (
          <SkeletonSprint />
        ) : sprint ? (
          <>
            <PageIntro
              eyebrow="Sprint plan"
              title={sprint.name}
              description="Jira-ready user stories with acceptance criteria, generated from your top-priority customer issues."
            />

            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-fade-in"
              style={{ animationDelay: "0.08s" }}
            >
              <MetricCard label="Owner" value={sprint.owner} icon={<User />} />
              <MetricCard
                label="Duration"
                value={`${sprint.duration_weeks}w`}
                icon={<Calendar />}
              />
              <MetricCard
                label="Story points"
                value={String(sprint.total_story_points)}
                accentColor="#A99FFF"
                icon={<Zap />}
              />
              <MetricCard
                label="Stories"
                value={String(sprint.stories.length)}
                icon={<ListTodo />}
              />
            </div>

            {PRIORITY_GROUPS.map((group) => {
              const stories = sprint.stories.filter((s) => s.priority === group.key);
              if (stories.length === 0) return null;
              return (
                <div key={group.key} className="mb-8 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${group.dot}`} aria-hidden />
                    <h2 className="text-base font-bold text-slate-200">{group.label}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 border border-white/[0.08] text-slate-500">
                      {stories.length} stories ·{" "}
                      {stories.reduce((a, s) => a + (s.story_points || 0), 0)} pts
                    </span>
                  </div>
                  <div className="space-y-3">
                    {stories.map((story) => (
                      <StoryCard key={story.id} story={story} sessionId={sessionId} />
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex gap-3 mt-4 flex-wrap border-t border-border pt-6">
              <Button asChild>
                <a href={exportUrls.sprint(sessionId)} download>
                  Export to Jira CSV
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/${sessionId}/export`}>All exports</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/${sessionId}/meeting`}>Discuss with AI</Link>
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            title="No sprint plan yet"
            description="Run analysis to generate a prioritised sprint from your customer feedback."
            action={{ label: "Back to dashboard", href: `/dashboard/${sessionId}` }}
          />
        )}
      </WorkspacePage>
    </div>
  );
}
