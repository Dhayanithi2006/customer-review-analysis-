"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  Map,
  LayoutDashboard,
  Mic,
  Home,
  Download,
} from "lucide-react";
import { getDashboard } from "@/lib/api";
import { exportUrls } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { PageLoader } from "@/components/shared/PageLoader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

const EXPORT_OPTIONS = [
  {
    id: "sprint",
    icon: Zap,
    title: "Sprint plan — Jira CSV",
    desc: "User stories with acceptance criteria, story points, and priority. Import directly into Jira.",
    format: "CSV",
    formatColor: "#22C55E",
    cta: "Download sprint CSV",
    key: "sprint" as const,
  },
  {
    id: "roadmap",
    icon: Map,
    title: "Product roadmap — Markdown",
    desc: "Six-week roadmap with themes, issues, rationale, and effort estimates. Ready for Notion or Confluence.",
    format: "Markdown",
    formatColor: "#A99FFF",
    cta: "Download roadmap",
    key: "roadmap" as const,
  },
];

export default function ExportPage() {
  const params = useParams();
  const sessionId = params.session_id as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard(sessionId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <PageLoader label="Preparing exports…" />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title="Export"
        sessionId={sessionId}
      />

      <WorkspacePage width="narrow">
        <PageIntro
          eyebrow="Export"
          title="Export your analysis"
          description="Download AI-generated outputs in formats your team already uses — Jira, Notion, and Confluence."
        />

        {data && (
          <div
            className="flex flex-wrap gap-6 mb-8 p-5 rounded-[18px] border border-border bg-surface animate-fade-in"
            style={{ animationDelay: "0.06s" }}
          >
            {[
              { label: "Reviews analysed", value: data.actionable_reviews.toLocaleString() },
              { label: "Priority issues", value: data.issues.length.toLocaleString() },
              { label: "Revenue at risk", value: `₹${(data.revenue_at_risk / 1000).toFixed(1)}K` },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
                  {m.label}
                </p>
                <p className="text-xl font-extrabold text-white">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 mb-10">
          {EXPORT_OPTIONS.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <div
                key={opt.id}
                className="group rounded-[18px] border border-border bg-surface p-5 md:p-6 transition-all duration-200 hover:border-white/[0.12] hover-lift animate-fade-in"
                style={{ animationDelay: `${i * 0.08 + 0.1}s` }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-surface-2 border border-white/[0.08] flex items-center justify-center shrink-0 text-primary-soft">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="font-bold text-white">{opt.title}</h2>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md border"
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
                      <Download className="size-3.5 mr-1.5" aria-hidden />
                      {opt.cta}
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <Separator className="mb-8" />

        <div className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
          <h2 className="font-semibold text-slate-300 mb-4 text-sm">Continue exploring</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { href: `/dashboard/${sessionId}`, icon: LayoutDashboard, label: "Dashboard" },
              { href: `/dashboard/${sessionId}/roadmap`, icon: Map, label: "Roadmap" },
              { href: `/dashboard/${sessionId}/sprint`, icon: Zap, label: "Sprint plan" },
              { href: `/dashboard/${sessionId}/meeting`, icon: Mic, label: "AI meeting" },
              { href: "/", icon: Home, label: "New analysis" },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-surface hover:border-white/[0.12] hover:bg-surface-2 transition-all text-sm font-medium text-slate-400 hover:text-slate-200 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Icon className="size-4 shrink-0 text-primary-soft" aria-hidden />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </WorkspacePage>
    </div>
  );
}
