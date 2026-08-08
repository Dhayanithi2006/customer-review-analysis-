"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  AlertTriangle,
  MessageSquareText,
  Map,
  Zap,
  TrendingUp,
  Bot,
  BarChart3,
  Download,
  QrCode,
  Smartphone,
  FileSpreadsheet,
  Plug,
  Settings,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import { getBusiness } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";
import { AppShell } from "@/components/layout/app-shell";
import type { SidebarNavSection } from "@/components/layout/sidebar";
import { DEMO_WORKSPACE } from "@/components/overview/demo-data";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz] = useState<BusinessResponse | null>(null);

  useEffect(() => {
    if (!businessId) return;
    getBusiness(businessId).then(setBiz).catch(() => null);
  }, [businessId]);

  const base = `/business/${businessId}`;
  const icon = { strokeWidth: 1.75 as const };

  const sidebarSections: SidebarNavSection[] = [
    {
      title: "Main",
      items: [
        {
          href: base,
          label: "Overview",
          icon: <LayoutDashboard {...icon} />,
          exact: true,
        },
        {
          href: `${base}/analysis`,
          label: "Issues",
          icon: <AlertTriangle {...icon} />,
        },
        {
          href: `${base}/reviews`,
          label: "Feedback",
          icon: <MessageSquareText {...icon} />,
        },
        {
          href: `${base}/roadmap`,
          label: "Roadmap",
          icon: <Map {...icon} />,
        },
        {
          href: `${base}/sprint`,
          label: "Sprints",
          icon: <Zap {...icon} />,
        },
        {
          href: `${base}/analysis?view=impact`,
          label: "Impact & Follow-ups",
          icon: <TrendingUp {...icon} />,
        },
        {
          href: `${base}/meeting`,
          label: "AI PM Assistant",
          icon: <Bot {...icon} />,
        },
        {
          href: `${base}/exports?view=reports`,
          label: "Reports",
          icon: <BarChart3 {...icon} />,
        },
        {
          href: `${base}/exports`,
          label: "Exports",
          icon: <Download {...icon} />,
        },
      ],
    },
    {
      title: "Data Sources",
      items: [
        {
          href: `${base}/sources?tab=qr`,
          label: "QR Feedback",
          icon: <QrCode {...icon} />,
        },
        {
          href: `${base}/sources?tab=app-store`,
          label: "App Store Reviews",
          icon: <Smartphone {...icon} />,
        },
        {
          href: `${base}/sources?tab=csv`,
          label: "CSV Imports",
          icon: <FileSpreadsheet {...icon} />,
        },
        {
          href: `${base}/sources?tab=integrations`,
          label: "Integrations",
          icon: <Plug {...icon} />,
        },
      ],
    },
    {
      title: "Settings",
      items: [
        {
          href: `${base}/settings`,
          label: "Business Settings",
          icon: <Settings {...icon} />,
          exact: true,
        },
        {
          href: `${base}/settings?tab=team`,
          label: "Team",
          icon: <Users {...icon} />,
        },
        {
          href: `${base}/settings?tab=preferences`,
          label: "Preferences",
          icon: <SlidersHorizontal {...icon} />,
        },
      ],
    },
  ];

  const workspaceLabel = biz?.business_name || DEMO_WORKSPACE.name;
  const workspaceSub = biz?.industry || DEMO_WORKSPACE.industry;

  return (
    <AppShell
      sidebarWidth={260}
      sidebarSections={sidebarSections}
      showUpgrade
      sidebarFooter={
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[12px] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all no-underline"
        >
          ← All sessions
        </Link>
      }
      nav={{
        workspaceName: workspaceLabel,
        workspaceSub,
        showSearch: true,
        userName: DEMO_WORKSPACE.userName,
        userRole: DEMO_WORKSPACE.userRole,
        ctaHref: "/",
        ctaLabel: "New Analysis",
      }}
    >
      {children}
    </AppShell>
  );
}
