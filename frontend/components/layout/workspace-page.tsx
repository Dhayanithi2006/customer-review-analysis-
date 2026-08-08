/**
 * Shared layout primitives for consistent spacing across polished pages.
 */
import { cn } from "@/lib/utils";

export function WorkspacePage({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "narrow" | "wide";
}) {
  const max =
    width === "narrow"
      ? "max-w-3xl"
      : width === "wide"
        ? "max-w-[1400px]"
        : "max-w-5xl";

  return (
    <div
      className={cn(
        "px-5 sm:px-8 lg:px-10 py-8 md:py-10 mx-auto animate-fade-in pb-16 md:pb-20",
        max,
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-h1">{title}</h1>
        {description && (
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  );
}
