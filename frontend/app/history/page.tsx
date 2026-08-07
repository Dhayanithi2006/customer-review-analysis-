"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessionHistory } from "@/lib/api";
import type { Session } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getSessionHistory()
      .then(data => setSessions(data.sessions || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#08090e]">
      <Navbar
        backHref="/"
        backLabel="Home"
        title="Session History"
      />

      <div className="mx-auto max-w-screen-md px-6 py-8">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-black text-slate-100 mb-1">Decision Log</h1>
            <p className="text-sm text-slate-400">View and revisit past review analysis sessions.</p>
          </div>
          <Button asChild size="sm">
            <Link href="/">+ New Analysis</Link>
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-6">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-5 rounded-2xl border border-white/7 bg-[#0f111a]">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isComplete = s.status === "complete";
              const isFailed   = s.status === "failed";
              const dateStr    = s.created_at ? new Date(s.created_at).toLocaleDateString() : "";

              return (
                <div
                  key={s.id}
                  className="group flex items-center justify-between p-5 rounded-2xl border border-white/7 bg-[#0f111a] hover:border-white/15 hover:bg-[#161827] transition-all duration-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-100 truncate">
                        {s.filename || `Session ${s.id.slice(0, 8)}`}
                      </span>
                      <Badge variant={isComplete ? "praise" : isFailed ? "bug" : "feature"}>
                        {s.status}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono">
                        {s.source.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>📊 {s.total_reviews.toLocaleString()} reviews</span>
                      {dateStr && <span>📅 {dateStr}</span>}
                      <span className="font-mono text-slate-600">ID: {s.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  <div className="shrink-0 ml-4">
                    {isComplete ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/${s.id}`}>Open Dashboard →</Link>
                      </Button>
                    ) : isFailed ? (
                      <span className="text-xs text-red-400 font-semibold">Failed</span>
                    ) : (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/${s.id}/processing`}>View Progress →</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl border border-white/7 bg-[#0f111a]">
            <div className="text-4xl mb-3">📜</div>
            <h3 className="font-bold text-slate-200 mb-1">No past sessions found</h3>
            <p className="text-xs text-slate-500 mb-6">Run your first analysis to populate the decision log.</p>
            <Button asChild size="sm">
              <Link href="/">🚀 Start Analysis</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
