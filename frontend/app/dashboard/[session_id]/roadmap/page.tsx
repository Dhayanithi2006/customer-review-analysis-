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

const EFFORT_COLOR: Record<string, string> = {
  "Quick Win": "#10b981",
  "Medium":    "#f59e0b",
  "Large":     "#ef4444",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/10 bg-[#161827] px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-slate-200 mb-0.5">Week {d.week}</p>
      <p className="text-slate-400">{d.theme}</p>
      <p className="font-semibold mt-1" style={{ color: EFFORT_COLOR[d.effort] || "#818cf8" }}>
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
    <div className="min-h-screen bg-[#08090e]">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title="Product Roadmap"
        sessionId={sessionId}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={exportUrls.roadmap(sessionId)} download id="btn-export-roadmap">
                ⬇️ Export MD
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${sessionId}/sprint`}>⚡ Sprint →</Link>
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-screen-md px-6 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-black text-slate-100 mb-2">6-Week Product Roadmap</h1>
          <p className="text-slate-400">
            Evidence-backed plan generated from your customer reviews. Every theme links to real feedback.
          </p>
        </div>

        {loading ? (
          <SkeletonRoadmap />
        ) : (
          <>
            {/* ── Effort Chart ── */}
            {roadmap.length > 0 && (
              <div className="rounded-2xl border border-white/7 bg-[#0f111a] p-5 mb-8 animate-fade-in">
                <h3 className="text-sm font-bold text-slate-300 mb-4">Issues per Week</h3>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData} barSize={32}>
                    <XAxis
                      dataKey="week"
                      tickFormatter={v => `W${v}`}
                      tick={{ fill: "#475569", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={EFFORT_COLOR[entry.effort] || "#6366f1"} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="flex gap-4 mt-3 flex-wrap">
                  {Object.entries(EFFORT_COLOR).map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Timeline ── */}
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

            {/* ── CTA ── */}
            <div className="flex gap-3 mt-10 flex-wrap">
              <Button asChild id="btn-to-sprint">
                <Link href={`/dashboard/${sessionId}/sprint`}>⚡ View Sprint Plan →</Link>
              </Button>
              <Button asChild variant="outline" id="btn-to-meeting">
                <Link href={`/dashboard/${sessionId}/meeting`}>🎤 Discuss with AI</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
