"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Radio,
  Files,
  Brain,
  Map,
  Zap,
  Download,
  Settings,
} from "lucide-react";
import { getBusiness, getLatestAnalysis } from "@/lib/business-api";
import type { BusinessResponse, LatestAnalysisResponse } from "@/lib/business-api";
import { AppShell } from "@/components/layout/app-shell";
import { BrandMark } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatRelativeDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function WorkspaceStatus({
  latest,
}: {
  latest: LatestAnalysisResponse | null;
}) {
  if (!latest) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        Loading
      </span>
    );
  }

  const status = latest.has_analysis
    ? latest.status || "complete"
    : latest.status === "pending" || latest.status === "running"
      ? latest.status
      : "idle";

  const map: Record<string, { dot: string; label: string; text: string }> = {
    complete: {
      dot: "bg-emerald-400",
      label: "Healthy",
      text: "text-emerald-400",
    },
    pending: {
      dot: "bg-amber-400 animate-pulse",
      label: "Pending",
      text: "text-amber-400",
    },
    running: {
      dot: "bg-primary-glow animate-pulse",
      label: "Analyzing",
      text: "text-primary-soft",
    },
    failed: {
      dot: "bg-red-400",
      label: "Failed",
      text: "text-red-400",
    },
    idle: {
      dot: "bg-slate-500",
      label: "Ready",
      text: "text-slate-400",
    },
  };

  const s = map[status] || map.idle;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", s.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz] = useState<BusinessResponse | null>(null);
  const [latest, setLatest] = useState<LatestAnalysisResponse | null>(null);

  useEffect(() => {
    if (!businessId) return;
    getBusiness(businessId).then(setBiz).catch(() => null);
    getLatestAnalysis(businessId).then(setLatest).catch(() => null);
  }, [businessId]);

  const lastAnalysisLabel = (() => {
    if (!latest) return "—";
    if (latest.has_analysis && latest.created_at) {
      return formatRelativeDate(latest.created_at) || latest.label || "—";
    }
    if (latest.status === "pending" || latest.status === "running") {
      return latest.label || "In progress";
    }
    return "Never";
  })();

  const base = `/business/${businessId}`;
  const sidebarItems = [
    {
      href: base,
      label: "Overview",
      icon: <LayoutDashboard strokeWidth={1.75} />,
      exact: true,
    },
    {
      href: `${base}/sources`,
      label: "Feedback Sources",
      icon: <Radio strokeWidth={1.75} />,
    },
    {
      href: `${base}/reviews`,
      label: "Review Repository",
      icon: <Files strokeWidth={1.75} />,
    },
    {
      href: `${base}/analysis`,
      label: "Decision Center",
      icon: <Brain strokeWidth={1.75} />,
    },
    {
      href: `${base}/roadmap`,
      label: "Roadmap",
      icon: <Map strokeWidth={1.75} />,
    },
    {
      href: `${base}/sprint`,
      label: "Sprint",
      icon: <Zap strokeWidth={1.75} />,
    },
    {
      href: `${base}/exports`,
      label: "Exports",
      icon: <Download strokeWidth={1.75} />,
    },
    {
      href: `${base}/settings`,
      label: "Settings",
      icon: <Settings strokeWidth={1.75} />,
    },
  ];

  return (
    <AppShell
      sidebarWidth={240}
      sidebarHeader={
        <p className="page-eyebrow px-2 mb-0">Workspace</p>
      }
      sidebarFooter={
        <>
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-200 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            ← All sessions
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-200 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            New workspace
          </Link>
        </>
      }
      sidebarItems={sidebarItems}
      nav={{
        brand: <BrandMark showWordmark={false} className="hidden sm:flex" />,
        leading: (
          <>
            <div className="hidden sm:block w-px h-5 bg-white/12" />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-[220px] md:max-w-[280px]">
                  {biz?.business_name || "Workspace"}
                </h1>
                <WorkspaceStatus latest={latest} />
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                Last analysis{" "}
                <span className="text-slate-400 font-medium">{lastAnalysisLabel}</span>
                {biz?.industry ? (
                  <>
                    <span className="text-slate-700 mx-1.5">·</span>
                    <span>{biz.industry}</span>
                  </>
                ) : null}
              </p>
            </div>
          </>
        ),
        actions: (
          <Button asChild size="sm">
            <Link href="/">Run Analysis</Link>
          </Button>
        ),
      }}
    >
      {children}
    </AppShell>
  );
}
