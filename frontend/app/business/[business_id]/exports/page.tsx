"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis } from "@/lib/business-api";
import type { LatestAnalysisResponse } from "@/lib/business-api";
import { exportUrls } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

const OPTIONS = [
  {
    title: "Sprint plan",
    desc: "Jira-ready CSV with stories, points, and priority.",
    format: "CSV",
    key: "sprint" as const,
  },
  {
    title: "Product roadmap",
    desc: "Six-week markdown roadmap for Notion or Confluence.",
    format: "Markdown",
    key: "roadmap" as const,
  },
];

export default function WorkspaceExportsPage() {
  const params = useParams();
  const businessId = params.business_id as string;
  const [latest, setLatest] = useState<LatestAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestAnalysis(businessId)
      .then(setLatest)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) {
    return (
      <WorkspacePage width="narrow">
        <ContentSkeleton variant="list" />
      </WorkspacePage>
    );
  }

  const sessionId =
    latest?.has_analysis && latest.status === "complete"
      ? latest.session_id
      : null;

  return (
    <WorkspacePage width="narrow">
      <PageIntro
        eyebrow="Exports"
        title="Export decisions to your toolchain"
        description="Downloads are generated from the latest completed analysis in this workspace."
      />

      {!sessionId ? (
        <EmptyState
          title="Nothing to export yet"
          description="Complete an analysis first. Exports unlock once the Decision Engine finishes a run."
          action={{ label: "Run analysis", href: "/" }}
          secondaryAction={{
            label: "Open Decision Center",
            href: `/business/${businessId}/analysis`,
          }}
        />
      ) : (
        <div className="space-y-4">
          {OPTIONS.map((opt) => (
            <div
              key={opt.key}
              className="rounded-[20px] border border-border bg-surface p-6 md:p-7 flex flex-col sm:flex-row sm:items-center gap-5 justify-between card-elevated hover-lift"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-bold text-white">{opt.title}</p>
                  <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded-md border border-white/[0.08]">
                    {opt.format}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <a href={exportUrls[opt.key](sessionId)} download>
                  Download
                </a>
              </Button>
            </div>
          ))}

          <p className="text-xs text-slate-600 pt-2">
            Based on {latest?.label || "latest analysis"}
            {latest?.created_at
              ? ` · ${new Date(latest.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}`
              : ""}
          </p>

          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/business/${businessId}/analysis`}>
                Back to Decision Center
              </Link>
            </Button>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}
