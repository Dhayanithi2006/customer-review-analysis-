"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getRoadmap, exportUrls } from "@/lib/api";
import type { RoadmapWeek } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { WeekCard } from "@/components/roadmap/WeekCard";
import { SkeletonRoadmap } from "@/components/roadmap/SkeletonRoadmap";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

const EFFORT_COLOR: Record<string, string> = {
  "Quick Win": "#22C55E",
  "Medium":    "#F59E0B",
  "Large":     "#EF4444",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-slate-200 mb-0.5">Week {d.week}</p>
      <p className="text-slate-400">{d.theme}</p>
      <p className="font-semibold mt-1" style={{ color: EFFORT_COLOR[d.effort] || "#A99FFF" }}>
        {d.effort} · {d.count} issues
      </p>
    </div>
  );
};

export default function RoadmapPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [roadmap, setRoadmap] = useState<RoadmapWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getRoadmap(sessionId)
      .then(r => setRoadmap(r.roadmap))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState message={error} onRetry={load} />;

  const chartData = roadmap.map(w => ({
    week: w.week,
    theme: w.theme.length > 20 ? w.theme.slice(0, 18) + "…" : w.theme,
    count: w.issues.length,
    effort: w.effort,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title="Product Roadmap"
        sessionId={sessionId}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={exportUrls.roadmap(sessionId)} download id="btn-export-roadmap">
                Export MD
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/sprint`}>Sprint →</Link>
            </Button>
          </div>
        }
      />

      <WorkspacePage width="narrow">
        <PageIntro
          eyebrow="Roadmap"
          title="6-week product roadmap"
          description="Evidence-backed plan generated from your customer reviews. Every theme links to real feedback."
        />

        {loading ? (
          <SkeletonRoadmap />
        ) : roadmap.length === 0 ? (
          <EmptyState
            title="No roadmap yet"
            description="Run analysis to generate a six-week plan from your customer issues."
            action={{ label: "Back to dashboard", href: `/dashboard/${sessionId}` }}
          />
        ) : (
          <>
            {roadmap.length > 0 && (
              <div className="rounded-[18px] border border-border bg-surface p-5 mb-8 animate-fade-in">
                <h2 className="text-sm font-bold text-slate-300 mb-4">Issues per week</h2>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData} barSize={32}>
                    <XAxis
                      dataKey="week"
                      tickFormatter={(v) => `W${v}`}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={EFFORT_COLOR[entry.effort] || "#6D5DF6"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="flex gap-4 mt-3 flex-wrap">
                  {Object.entries(EFFORT_COLOR).map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} aria-hidden />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              {roadmap.map((week, i) => (
                <WeekCard
                  key={i}
                  week={week}
                  sessionId={sessionId}
                  index={i}
                  isLast={i === roadmap.length - 1}
                />
              ))}
            </div>

            <div className="flex gap-3 mt-10 flex-wrap">
              <Button asChild id="btn-to-sprint">
                <Link href={`/dashboard/${sessionId}/sprint`}>View sprint plan</Link>
              </Button>
              <Button asChild variant="outline" id="btn-to-meeting">
                <Link href={`/dashboard/${sessionId}/meeting`}>Discuss with AI</Link>
              </Button>
            </div>
          </>
        )}
      </WorkspacePage>
    </div>
  );
}
