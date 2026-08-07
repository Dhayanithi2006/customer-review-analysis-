"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  exact?: boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  open?: boolean;
  onClose?: () => void;
  className?: string;
  width?: number | string;
}

export function Sidebar({
  items,
  header,
  footer,
  open = false,
  onClose,
  className,
  width = "var(--sidebar-width)",
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (item: SidebarItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

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
          "flex flex-col shrink-0 border-r border-border bg-[#0E1424]",
          "fixed lg:sticky top-[var(--topnav-height)] left-0 bottom-0 z-40",
          "h-[calc(100vh-var(--topnav-height))] overflow-y-auto",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className
        )}
      >
        <div className="flex flex-col flex-1 p-3 sm:p-4 gap-1">
          {header && <div className="mb-3 px-1">{header}</div>}

          <nav className="flex flex-col gap-0.5" aria-label="Sidebar">
            {items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium no-underline",
                    "transition-all duration-200 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    active
                      ? "bg-primary/15 text-primary-soft-2"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] hover:translate-x-px"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary-glow sidebar-active-dot" />
                  )}
                  {item.icon && (
                    <span
                      className={cn(
                        "shrink-0 w-5 flex justify-center transition-colors duration-200 [&_svg]:size-4",
                        active
                          ? "text-primary-soft"
                          : "text-slate-500 group-hover:text-slate-300"
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-glow shrink-0 sidebar-active-dot" />
                  )}
                </Link>
              );
            })}
          </nav>

          {footer && (
            <div className="mt-auto pt-4 border-t border-border space-y-0.5">
              {footer}
            </div>
          )}
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
