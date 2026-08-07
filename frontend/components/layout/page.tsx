import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "default" | "lg" | "full";
}) {
  const max = {
    sm: "max-w-3xl",
    default: "max-w-screen-xl",
    lg: "max-w-[1400px]",
    full: "max-w-none",
  }[size];

  return (
    <div
      className={cn(
        "w-full mx-auto px-5 sm:px-6 md:px-8 lg:px-10",
        max,
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8 md:mb-10",
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {breadcrumb && (
          <div className="text-xs text-slate-500 mb-1">{breadcrumb}</div>
        )}
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          {title}
        </h1>
        {description && (
          <p className="text-sm md:text-base text-slate-400 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-10 md:mb-12", className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            {title && (
              <h2 className="text-lg font-bold text-white tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-slate-500 mt-1">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("page-content animate-fade-in", className)}>
      {children}
    </div>
  );
}
