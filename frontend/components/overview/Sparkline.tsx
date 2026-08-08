"use client";

import { cn } from "@/lib/utils";

/** Tiny SVG sparkline for KPI cards and table rows */
export function Sparkline({
  points,
  color = "#6D5DF6",
  className,
  fill = true,
}: {
  points: number[];
  color?: string;
  className?: string;
  fill?: boolean;
}) {
  if (!points.length) return null;
  const w = 72;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1 || 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("w-[72px] h-7 overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && (
        <polygon points={area} fill={color} opacity={0.12} />
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Deterministic pseudo-random sparkline from a seed */
export function seededSparkline(seed: number, len = 8, trend: "up" | "down" | "flat" = "flat") {
  const pts: number[] = [];
  let v = 40 + (seed % 30);
  for (let i = 0; i < len; i++) {
    const noise = ((seed * (i + 3) * 17) % 13) - 6;
    if (trend === "up") v += 2 + noise * 0.4;
    else if (trend === "down") v -= 2 + noise * 0.4;
    else v += noise * 0.5;
    pts.push(Math.max(5, v));
  }
  return pts;
}
