"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessionHistory } from "@/lib/api";
import type { Session } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getSessionHistory()
      .then((data) => setSessions(data.sessions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar backHref="/" backLabel="Home" title="Past sessions" />

      <WorkspacePage width="narrow">
        <PageIntro
          eyebrow="Decision log"
          title="Past analysis sessions"
          description="Revisit completed runs and continue in-progress analyses."
          actions={
            <Button asChild size="sm">
              <Link href="/">New analysis</Link>
            </Button>
          }
        />

        {error && (
          <div
            role="alert"
            className="p-4 rounded-[16px] bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-6 flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading sessions">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="p-5 rounded-[18px] border border-border bg-surface"
              >
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isComplete = s.status === "complete";
              const isFailed = s.status === "failed";
              const dateStr = s.created_at
                ? new Date(s.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "";

              return (
                <div
                  key={s.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[18px] border border-border bg-surface hover-lift card-elevated"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-sm text-white truncate">
                        {s.filename || `Session ${s.id.slice(0, 8)}`}
                      </span>
                      <Badge
                        variant={
                          isComplete ? "success" : isFailed ? "danger" : "primary"
                        }
                      >
                        {s.status}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono capitalize">
                        {s.source.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
                      <span>{s.total_reviews.toLocaleString()} reviews</span>
                      {dateStr && <span>{dateStr}</span>}
                      <span className="font-mono text-slate-600">
                        {s.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isComplete ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/${s.id}`}>Open dashboard</Link>
                      </Button>
                    ) : isFailed ? (
                      <span className="text-xs text-red-400 font-semibold">Failed</span>
                    ) : (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/${s.id}/processing`}>
                          View progress
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No sessions yet"
            description="Run your first analysis to start building a decision history."
            action={{ label: "Analyze feedback", href: "/" }}
          />
        )}
      </WorkspacePage>
    </div>
  );
}
