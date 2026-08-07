"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  sessionId?: string;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function Navbar({ sessionId, title, backHref, backLabel, actions }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/7 bg-[#08090e]/85 backdrop-blur-xl">
      <div className="mx-auto max-w-screen-xl px-6 flex items-center justify-between h-14 gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {backHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={backHref}>
                <span>←</span>
                <span className="hidden sm:inline">{backLabel || "Back"}</span>
              </Link>
            </Button>
          ) : (
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm shadow-[0_0_12px_rgba(99,102,241,0.4)]">
                🗺️
              </div>
              <span className="font-black text-base tracking-tight text-slate-100">RoadmapAI</span>
            </Link>
          )}

          {title && (
            <>
              <span className="text-white/20 text-lg hidden sm:block">·</span>
              <span className="font-semibold text-sm text-slate-300 truncate hidden sm:block">{title}</span>
            </>
          )}

          {sessionId && (
            <>
              <span className="text-white/20 text-lg hidden md:block">·</span>
              <span className="text-xs text-slate-500 font-mono hidden md:block">{sessionId.slice(0, 8)}</span>
            </>
          )}
        </div>

        {/* Right */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </nav>
  );
}
