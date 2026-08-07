"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface TopNavProps {
  brandHref?: string;
  brand?: React.ReactNode;
  /** Rich left content after brand / menu (e.g. workspace title) */
  leading?: React.ReactNode;
  title?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  className?: string;
}

export function TopNav({
  brandHref = "/",
  brand,
  leading,
  title,
  breadcrumb,
  actions,
  onMenuClick,
  showMenuButton = false,
  className,
}: TopNavProps) {
  return (
    <header className={cn("top-nav sticky top-0 z-50", className)}>
      <div className="flex items-center justify-between h-[var(--topnav-height)] px-4 md:px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {showMenuButton && (
            <Button
              variant="outline"
              size="icon-sm"
              className="lg:hidden shrink-0"
              onClick={onMenuClick}
              aria-label="Toggle navigation"
              aria-expanded={undefined}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </Button>
          )}

          {brand ?? (
            <Link
              href={brandHref}
              className="flex items-center gap-2.5 shrink-0 no-underline"
            >
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-[0_4px_14px_rgba(109,93,246,0.28)]">
                <span className="text-white text-xs font-extrabold tracking-tight">R</span>
              </div>
              <span className="font-extrabold text-sm tracking-tight text-white hidden sm:block">
                RoadmapAI
              </span>
            </Link>
          )}

          {leading}

          {breadcrumb && !leading && (
            <>
              <span className="text-slate-700 hidden sm:block select-none">/</span>
              <div className="min-w-0 truncate text-sm text-slate-400">
                {breadcrumb}
              </div>
            </>
          )}

          {title && !breadcrumb && !leading && (
            <>
              <span className="text-white/15 text-lg hidden sm:block">·</span>
              <span className="font-semibold text-sm text-slate-300 truncate hidden sm:block">
                {title}
              </span>
            </>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
}

export function BrandMark({
  href = "/",
  showWordmark = true,
  className,
}: {
  href?: string;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 shrink-0 no-underline", className)}
    >
      <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-[0_4px_14px_rgba(109,93,246,0.28)]">
        <span className="text-white text-xs font-extrabold tracking-tight">R</span>
      </div>
      {showWordmark && (
        <span className="font-extrabold text-sm tracking-tight text-white">
          RoadmapAI
        </span>
      )}
    </Link>
  );
}
