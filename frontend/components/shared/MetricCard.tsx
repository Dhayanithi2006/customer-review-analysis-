import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  accentColor?: string;
  icon?: string;
  id?: string;
  className?: string;
}

export function MetricCard({ label, value, sub, accentColor, icon, id, className }: MetricCardProps) {
  return (
    <div
      id={id}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/7 bg-[#0f111a] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-250 group hover:border-white/14 hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] hover:-translate-y-px",
        className
      )}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-250"
        style={{ background: "linear-gradient(90deg, #6366f1, #06b6d4)" }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">{label}</p>
          <p
            className="text-2xl font-black tracking-tight leading-none truncate"
            style={{ color: accentColor || "var(--color-text-primary)" }}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-slate-500 mt-1.5 leading-tight">{sub}</p>}
        </div>
        {icon && <span className="text-2xl shrink-0 mt-0.5">{icon}</span>}
      </div>
    </div>
  );
}
