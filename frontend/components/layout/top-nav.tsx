"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  Moon,
  ChevronDown,
  Store,
  Plus,
} from "lucide-react";
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
  /** Workspace / org switcher label */
  workspaceName?: string;
  workspaceSub?: string;
  /** Show search bar (mockup style) */
  showSearch?: boolean;
  /** User display */
  userName?: string;
  userRole?: string;
  /** CTA on the right */
  ctaHref?: string;
  ctaLabel?: string;
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
  workspaceName,
  workspaceSub,
  showSearch = true,
  userName = "Arjun Kumar",
  userRole = "Product Manager",
  ctaHref = "/",
  ctaLabel = "New Analysis",
  className,
}: TopNavProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-[64px] border-b border-white/[0.06]",
        "bg-[#0B0E14]/85 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6 gap-3 md:gap-4">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          {showMenuButton && (
            <Button
              variant="outline"
              size="icon-sm"
              className="lg:hidden shrink-0"
              onClick={onMenuClick}
              aria-label="Toggle navigation"
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

          {brand}

          {workspaceName ? (
            <button
              type="button"
              className={cn(
                "flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03]",
                "px-3 py-2 text-left hover:bg-white/[0.05] transition-colors max-w-[240px]"
              )}
            >
              <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Store className="size-4 text-emerald-400" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 hidden sm:block">
                <span className="block text-[13px] font-semibold text-white truncate leading-tight">
                  {workspaceName}
                </span>
                {workspaceSub && (
                  <span className="block text-[10px] text-slate-500 truncate mt-0.5">
                    {workspaceSub}
                  </span>
                )}
              </span>
              <ChevronDown className="size-3.5 text-slate-500 shrink-0 hidden sm:block" />
            </button>
          ) : (
            leading
          )}

          {breadcrumb && !leading && !workspaceName && (
            <>
              <span className="text-slate-700 hidden sm:block select-none">/</span>
              <div className="min-w-0 truncate text-sm text-slate-400">
                {breadcrumb}
              </div>
            </>
          )}

          {title && !breadcrumb && !leading && !workspaceName && (
            <>
              <span className="text-white/15 text-lg hidden sm:block">·</span>
              <span className="font-semibold text-sm text-slate-300 truncate hidden sm:block">
                {title}
              </span>
            </>
          )}
        </div>

        {showSearch && (
          <div className="hidden md:flex flex-1 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className={cn(
                "relative w-full h-10 rounded-full bg-white/[0.04] border border-white/[0.08]",
                "pl-10 pr-14 text-sm text-left text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]",
                "outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20",
                "transition-all flex items-center justify-between cursor-pointer"
              )}
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none" />
              <span>Search issues, feedback, roadmaps...</span>
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-500 bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-0.5">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions ?? (
            <>
              <button
                type="button"
                className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                aria-label="Toggle theme"
              >
                <Moon className="size-4" strokeWidth={1.75} />
              </button>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v: boolean) => !v)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" strokeWidth={1.75} />
                  <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-[#0B0E14]">
                    3
                  </span>
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/[0.1] bg-[#111827] shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Notifications</p>
                      <span className="text-[10px] text-primary-soft bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">3 New</span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="font-semibold text-slate-200">Feedback Loop Activated</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Checkout Waiting Time marked Action Taken. Follow-ups dispatched.</p>
                        <p className="text-[10px] text-slate-500 mt-1">2m ago</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="font-semibold text-red-300">Issue Reopened Alert</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">Payment Failure improvement score (30.0%) below threshold.</p>
                        <p className="text-[10px] text-red-400 mt-1">12m ago</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="font-semibold text-slate-200">QR Code Ingestion</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">New in-store feedback received via on-site QR scanner.</p>
                        <p className="text-[10px] text-slate-500 mt-1">1h ago</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:flex items-center gap-2.5 pl-2 ml-1 border-l border-white/[0.08]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-400 flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm">
                  {userName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white leading-tight truncate max-w-[120px]">
                    {userName}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">{userRole}</p>
                </div>
              </div>

              <Button asChild size="sm" className="ml-1 rounded-xl shadow-[0_4px_14px_rgba(109,93,246,0.35)]">
                <Link href={ctaHref}>
                  <Plus className="size-3.5" strokeWidth={2.5} />
                  <span className="hidden sm:inline">{ctaLabel}</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Command Palette (⌘K) Modal */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0E1422] shadow-2xl overflow-hidden">
            <div className="flex items-center px-4 border-b border-white/[0.08]">
              <Search className="size-4 text-slate-400 mr-3 shrink-0" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Type a command or search issues..."
                className="w-full h-12 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md bg-white/[0.05]"
              >
                ESC
              </button>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5">Navigation</p>
              {[
                { label: "Overview Dashboard", href: "/", icon: "📊" },
                { label: "Critical Issues & Attention", href: "/business/freshmart/analysis", icon: "🔴" },
                { label: "Customer Feedback Stream", href: "/business/freshmart/reviews", icon: "💬" },
                { label: "AI Product Roadmap", href: "/business/freshmart/roadmap", icon: "🗺️" },
                { label: "Sprint Planning & Stories", href: "/business/freshmart/sprint", icon: "⚡" },
                { label: "Data Sources & QR Codes", href: "/business/freshmart/sources", icon: "📱" },
                { label: "Workspace Settings", href: "/business/freshmart/settings", icon: "⚙️" },
              ]
                .filter((item) => item.label.toLowerCase().includes(cmdQuery.toLowerCase()))
                .map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setCmdOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-primary/20 transition-colors no-underline"
                  >
                    <span className="flex items-center gap-2.5">
                      <span>{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Jump to →</span>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}
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
      <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-[0_4px_14px_rgba(109,93,246,0.35)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 18L10 6l4 8 2-4 4 8"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showWordmark && (
        <span className="font-extrabold text-[15px] tracking-tight text-white">
          RoadmapAI
        </span>
      )}
    </Link>
  );
}
