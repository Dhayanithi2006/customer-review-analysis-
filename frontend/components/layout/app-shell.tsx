"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TopNav, type TopNavProps } from "@/components/layout/top-nav";
import { Sidebar, type SidebarItem } from "@/components/layout/sidebar";

export interface AppShellProps {
  children: React.ReactNode;
  nav?: TopNavProps;
  sidebarItems?: SidebarItem[];
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  showSidebar?: boolean;
  sidebarWidth?: number | string;
  className?: string;
  contentClassName?: string;
}

/**
 * Shared application chrome: TopNav + optional Sidebar + main content.
 */
export function AppShell({
  children,
  nav,
  sidebarItems = [],
  sidebarHeader,
  sidebarFooter,
  showSidebar = true,
  sidebarWidth = "var(--sidebar-width)",
  className,
  contentClassName,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground flex flex-col",
        className
      )}
    >
      <TopNav
        {...nav}
        showMenuButton={showSidebar && sidebarItems.length > 0}
        onMenuClick={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex flex-1 min-h-0 relative">
        {showSidebar && sidebarItems.length > 0 && (
          <Sidebar
            items={sidebarItems}
            header={sidebarHeader}
            footer={sidebarFooter}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            width={sidebarWidth}
          />
        )}

        <main className={cn("flex-1 min-w-0 overflow-auto", contentClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
