"use client";

import * as React from "react";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { TopNav, type TopNavProps } from "@/components/layout/top-nav";
import {
  Sidebar,
  type SidebarItem,
  type SidebarNavSection,
} from "@/components/layout/sidebar";

export interface AppShellProps {
  children: React.ReactNode;
  nav?: TopNavProps;
  sidebarItems?: SidebarItem[];
  sidebarSections?: SidebarNavSection[];
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  sidebarBrand?: React.ReactNode;
  showUpgrade?: boolean;
  showSidebar?: boolean;
  sidebarWidth?: number | string;
  className?: string;
  contentClassName?: string;
}

/**
 * Shared application chrome: full-height Sidebar + TopNav + main content.
 * Matches RoadmapAI dashboard shell (sidebar left, content column right).
 */
export function AppShell({
  children,
  nav,
  sidebarItems = [],
  sidebarSections,
  sidebarHeader,
  sidebarFooter,
  sidebarBrand,
  showUpgrade = true,
  showSidebar = true,
  sidebarWidth = "var(--sidebar-width)",
  className,
  contentClassName,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const hasSidebar =
    showSidebar &&
    ((sidebarSections && sidebarSections.length > 0) ||
      sidebarItems.length > 0);

  return (
    <div
      className={cn(
        "min-h-screen bg-[#0B0E14] text-foreground flex",
        className
      )}
    >
      {hasSidebar && (
        <Suspense fallback={
          <aside
            style={{ width: sidebarWidth }}
            className="hidden lg:block shrink-0 border-r border-white/[0.06] bg-[#0A0D16] h-screen"
          />
        }>
          <Sidebar
            items={sidebarItems}
            sections={sidebarSections}
            header={sidebarHeader}
            footer={sidebarFooter}
            brand={sidebarBrand}
            showUpgrade={showUpgrade}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            width={sidebarWidth}
          />
        </Suspense>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopNav
          {...nav}
          showMenuButton={hasSidebar}
          onMenuClick={() => setSidebarOpen((v) => !v)}
        />

        <main className={cn("flex-1 min-w-0 overflow-auto", contentClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
