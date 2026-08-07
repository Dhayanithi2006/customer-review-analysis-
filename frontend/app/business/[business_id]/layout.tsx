"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { getBusiness } from "@/lib/business-api";
import type { BusinessResponse } from "@/lib/business-api";

const INDUSTRY_ICONS: Record<string, string> = {
  "Mobile App": "📱", "SaaS": "☁️", "E-commerce": "🛒",
  "Hospital": "🏥", "School": "🏫", "Hostel": "🏠",
  "Supermarket": "🛍️", "Restaurant": "🍽️", "Hotel": "🏨", "Bank": "🏦",
};

const NAV = [
  { href: "",           icon: "🏠", label: "Overview"        },
  { href: "/analysis",  icon: "🧠", label: "Decision Center" },
  { href: "/roadmap",   icon: "🗺️", label: "Roadmap"         },
  { href: "/sprint",    icon: "⚡", label: "Sprint Plan"     },
  { href: "/reviews",   icon: "📋", label: "Review Repository" },
  { href: "/settings",  icon: "⚙️", label: "Settings"        },
];

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params     = useParams();
  const pathname   = usePathname();
  const businessId = params.business_id as string;
  const [biz, setBiz] = useState<BusinessResponse | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (businessId) {
      getBusiness(businessId).then(setBiz).catch(() => null);
    }
  }, [businessId]);

  const isActive = (href: string) => {
    const full = `/business/${businessId}${href}`;
    if (href === "") return pathname === `/business/${businessId}`;
    return pathname.startsWith(full);
  };

  return (
    <div className="min-h-screen bg-[#08090e] text-slate-100 flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[5%] w-[500px] h-[500px] bg-indigo-600/4 rounded-full blur-[120px]" />
      </div>

      {/* Top navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#08090e]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left: Logo + breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href="/" className="flex items-center gap-2 no-underline shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm shadow-[0_0_12px_rgba(99,102,241,0.4)]">
                🗺️
              </div>
              <span className="font-black text-sm tracking-tight text-slate-100 hidden sm:block">RoadmapAI</span>
            </Link>
            <span className="text-slate-700 hidden sm:block">/</span>
            <span className="text-xs text-slate-400 truncate max-w-[120px] sm:max-w-[200px] font-medium">
              {biz ? (
                <span className="flex items-center gap-1.5">
                  <span>{INDUSTRY_ICONS[biz.industry] || "🏢"}</span>
                  {biz.business_name}
                </span>
              ) : "Loading…"}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {biz && (
              <Link
                href={`/business/${businessId}/analysis`}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
              >
                🧠 Decision Center
              </Link>
            )}
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="sm:hidden w-8 h-8 rounded-lg border border-white/8 flex items-center justify-center text-slate-400 hover:text-slate-200"
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 relative z-10">
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? "flex" : "hidden"} sm:flex
          flex-col w-56 shrink-0 border-r border-white/6 bg-[#0a0b10]
          sm:sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto
          fixed top-14 left-0 bottom-0 z-40 sm:relative
        `}>
          <div className="p-4">
            {/* Business card */}
            {biz && (
              <div className="mb-5 p-3 rounded-xl bg-[#0d0f1a] border border-white/6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/25 flex items-center justify-center text-sm">
                    {INDUSTRY_ICONS[biz.industry] || "🏢"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-100 truncate">{biz.business_name}</p>
                    <p className="text-[10px] text-slate-500">{biz.industry}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-slate-500">Workspace Active</span>
                </div>
              </div>
            )}

            {/* Nav links */}
            <nav className="space-y-0.5">
              {NAV.map(item => {
                const active = isActive(item.href);
                const href = `/business/${businessId}${item.href}`;
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all no-underline ${
                      active
                        ? "bg-indigo-600/15 border border-indigo-500/25 text-indigo-300"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    {item.label}
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </Link>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold px-3 mb-2">Quick Links</p>
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/4 transition-all no-underline"
              >
                <span>🚀</span> Analyse Feedback
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/4 transition-all no-underline"
              >
                <span>➕</span> New Workspace
              </Link>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
