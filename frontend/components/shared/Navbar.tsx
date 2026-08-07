"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/top-nav";

interface NavbarProps {
  sessionId?: string;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function Navbar({ sessionId, title, backHref, backLabel, actions }: NavbarProps) {
  return (
    <nav className="top-nav sticky top-0 z-50">
      <div className="mx-auto max-w-screen-xl px-4 md:px-6 flex items-center justify-between h-[var(--topnav-height)] gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {backHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={backHref}>
                <span aria-hidden>←</span>
                <span className="hidden sm:inline">{backLabel || "Back"}</span>
              </Link>
            </Button>
          ) : (
            <BrandMark />
          )}

          {title && (
            <>
              <span className="text-white/15 text-lg hidden sm:block">·</span>
              <span className="font-semibold text-sm text-slate-300 truncate hidden sm:block">
                {title}
              </span>
            </>
          )}

          {sessionId && (
            <>
              <span className="text-white/15 text-lg hidden md:block">·</span>
              <span className="text-xs text-slate-500 font-mono hidden md:block">
                {sessionId.slice(0, 8)}
              </span>
            </>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </nav>
  );
}
