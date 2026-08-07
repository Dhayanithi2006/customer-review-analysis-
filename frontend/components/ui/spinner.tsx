import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

export function Spinner({ className, size = "md", label }: SpinnerProps) {
  return (
    <div
      className={cn("inline-flex flex-col items-center gap-3", className)}
      role="status"
      aria-label={label || "Loading"}
    >
      <div
        className={cn(
          "rounded-full border-white/10 border-t-[#6D5DF6] animate-spin",
          sizeMap[size]
        )}
      />
      {label && (
        <p className="text-sm text-slate-500 animate-pulse-soft">{label}</p>
      )}
      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}
