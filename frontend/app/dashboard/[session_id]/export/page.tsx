"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDashboard } from "@/lib/api";
import { exportUrls } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { PageLoader } from "@/components/shared/PageLoader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const EXPORT_OPTIONS = [
  {
    id: "sprint",
    icon: "⚡",
    title: "Sprint Plan — Jira CSV",
    desc: "All user stories with acceptance criteria, story points, and priority. Import directly into Jira.",
    format: "CSV",
    formatColor: "#10b981",
    cta: "Download Sprint CSV",
    key: "sprint" as const,
  },
  {
    id: "roadmap",
    icon: "🗺️",
    title: "Product Roadmap — Markdown",
    desc: "6-week roadmap with themes, issues, rationale, and effort estimates. Ready for Notion or Confluence.",
    format: "Markdown",
    formatColor: "#818cf8",
    cta: "Download Roadmap MD",
    key: "roadmap" as const,
  },
];

export default function ExportPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard(sessionId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <PageLoader label="Preparing exports…" />;

  return (
    <div className="min-h-screen bg-[#08090e]">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title="Export"
        sessionId={sessionId}
      />

      <div className="mx-auto max-w-screen-md px-6 py-10">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl font-black text-slate-100 mb-2">Export Your Analysis</h1>
          <p className="text-slate-400">
            Download your AI-generated outputs as industry-standard formats ready for Jira, Notion, and Confluence.
          </p>
        </div>

        {/* Session info */}
        {data && (
          <div className="flex flex-wrap gap-6 mb-8 p-4 rounded-2xl border border-white/7 bg-[#0f111a] animate-fade-in" style={{ animationDelay: "0.06s" }}>
            {[
              { label: "Reviews Analysed", value: data.actionable_reviews.toLocaleString() },
              { label: "Priority Issues",  value: data.issues.length.toLocaleString() },
              { label: "Revenue at Risk",  value: `₹${(data.revenue_at_risk / 1000).toFixed(1)}K` },
            ].map(m => (
              <div key={m.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">{m.label}</p>
                <p className="text-xl font-black text-slate-100">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Export cards */}
        <div className="space-y-4 mb-10">
          {EXPORT_OPTIONS.map((opt, i) => (
            <div
              key={opt.id}
              className="group rounded-2xl border border-white/7 bg-[#0f111a] p-6 transition-all duration-200 hover:border-white/15 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)] animate-fade-in"
              style={{ animationDelay: `${i * 0.08 + 0.1}s` }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#161827] border border-white/10 flex items-center justify-center text-2xl shrink-0">
                    {opt.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-100">{opt.title}</h3>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded border"
                        style={{
                          color: opt.formatColor,
                          borderColor: `${opt.formatColor}40`,
                          background: `${opt.formatColor}12`,
                        }}
                      >
                        {opt.format}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                </div>

                <a
                  href={exportUrls[opt.key](sessionId)}
                  download
                  id={`btn-export-${opt.id}`}
                  className="shrink-0"
                >
                  <Button size="sm">
                    ⬇️ {opt.cta}
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>

        <Separator className="mb-8" />

        {/* Share / navigate */}
        <div className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
          <h2 className="font-bold text-slate-300 mb-4 text-sm">Continue Exploring</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { href: `/dashboard/${sessionId}`,           icon: "📊", label: "Dashboard" },
              { href: `/dashboard/${sessionId}/roadmap`,   icon: "🗺️", label: "Roadmap" },
              { href: `/dashboard/${sessionId}/sprint`,    icon: "⚡", label: "Sprint Plan" },
              { href: `/dashboard/${sessionId}/meeting`,   icon: "🎤", label: "AI Meeting" },
              { href: "/",                                  icon: "🏠", label: "New Analysis" },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/7 bg-[#0f111a] hover:border-white/15 hover:bg-[#161827] transition-all text-sm font-medium text-slate-400 hover:text-slate-200 no-underline"
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
