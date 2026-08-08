"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";

export interface SidebarItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  exact?: boolean;
}

export interface SidebarNavSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  items?: SidebarItem[];
  sections?: SidebarNavSection[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  brand?: React.ReactNode;
  showUpgrade?: boolean;
  open?: boolean;
  onClose?: () => void;
  className?: string;
  width?: number | string;
}

function NavLink({
  item,
  active,
  onClose,
}: {
  item: SidebarItem;
  active: boolean;
  onClose?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium no-underline",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "bg-primary text-white shadow-[0_4px_14px_rgba(109,93,246,0.35)]"
          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
      )}
    >
      {item.icon && (
        <span
          className={cn(
            "shrink-0 w-5 flex justify-center transition-colors duration-200 [&_svg]:size-[18px]",
            active ? "text-white" : "text-slate-500 group-hover:text-slate-300"
          )}
        >
          {item.icon}
        </span>
      )}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function parseHref(href: string) {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  return { path, params };
}

export function Sidebar({
  items = [],
  sections,
  header,
  footer,
  brand,
  showUpgrade = true,
  open = false,
  onClose,
  className,
  width = "var(--sidebar-width)",
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = (item: SidebarItem) => {
    const { path, params } = parseHref(item.href);
    if (item.exact) {
      if (pathname !== path) return false;
      return (
        params.toString() === "" ||
        [...params.entries()].every(([k, v]) => searchParams.get(k) === v)
      );
    }
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    if (params.toString()) {
      return [...params.entries()].every(([k, v]) => searchParams.get(k) === v);
    }
    const hasTabSibling = searchParams.has("tab") || searchParams.has("view");
    if (hasTabSibling && path === pathname) {
      return !searchParams.has("tab") && !searchParams.has("view");
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const navSections: SidebarNavSection[] =
    sections && sections.length > 0 ? sections : [{ items }];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        style={{ width }}
        className={cn(
          "flex flex-col shrink-0 border-r border-white/[0.06] bg-[#0A0D16]",
          "fixed lg:sticky top-0 left-0 z-40",
          "h-screen overflow-y-auto",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className
        )}
      >
        <div className="flex flex-col flex-1 p-4 gap-1 min-h-0">
          <div className="px-2 pt-1 pb-5">
            {brand ?? <BrandMark href="/" />}
          </div>

          {header && <div className="mb-2 px-1">{header}</div>}

          <nav className="flex flex-col gap-5 flex-1 min-h-0" aria-label="Sidebar">
            {navSections.map((section, si) => (
              <div key={section.title ?? `section-${si}`} className="flex flex-col gap-0.5">
                {section.title && (
                  <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    {section.title}
                  </p>
                )}
                {section.items.map((item, ii) => (
                  <NavLink
                    key={`${item.href}-${item.label}-${ii}`}
                    item={item}
                    active={isActive(item)}
                    onClose={onClose}
                  />
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-auto pt-4 space-y-3 shrink-0">
            {showUpgrade && (
              <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/20 to-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/30 flex items-center justify-center">
                    <Rocket className="size-4 text-primary-soft-2" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-bold text-white">Upgrade to Pro</p>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Unlock advanced AI insights, unlimited analyses, and priority support.
                </p>
                <Button size="sm" className="w-full rounded-xl">
                  Upgrade Now
                </Button>
              </div>
            )}
            {footer}
          </div>
        </div>
      </aside>
    </>
  );
}

export function SidebarSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-5 pt-4 border-t border-border", className)}>
      {title && <p className="page-eyebrow px-3 mb-2">{title}</p>}
      {children}
    </div>
  );
}

export function SidebarCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-3.5 rounded-[16px] bg-surface border border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
