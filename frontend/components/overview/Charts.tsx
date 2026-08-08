"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { chartTheme, colors } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export function SentimentDonut({
  negative,
  positive,
  neutral,
  total = 2041,
}: {
  negative: number;
  positive: number;
  neutral: number;
  total?: number;
}) {
  const data = [
    { name: "Negative", value: negative, color: "#EF4444" },
    { name: "Positive", value: positive, color: "#22C55E" },
    { name: "Neutral", value: neutral, color: "#F59E0B" },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-[14px] font-bold text-white tracking-tight mb-0.5">
        Feedback Sentiment
      </h3>
      <p className="text-[11px] text-slate-500 mb-3">Distribution across all sources</p>

      <div className="relative flex-1 min-h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: "Empty", value: 1, color: "#1C2538" }]}
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={74}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {(data.length ? data : [{ color: "#1C2538" }]).map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[1.35rem] font-extrabold text-white tabular-nums leading-none">
            {total.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Total</span>
        </div>
      </div>

          <div className="flex flex-col gap-1.5 mt-2">
        {[
          { label: "Negative", pct: negative, color: "bg-red-500" },
          { label: "Positive", pct: positive, color: "bg-emerald-500" },
          { label: "Neutral", pct: neutral, color: "bg-amber-500" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-[12px] text-slate-400"
          >
            <span className="inline-flex items-center gap-2">
              <span className={cn("w-2.5 h-2.5 rounded-[3px]", item.color)} />
              {item.label}
            </span>
            <span className="text-slate-200 font-semibold tabular-nums">
              {Number(item.pct).toFixed(Number(item.pct) % 1 ? 1 : 0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueTrendChart({
  data,
}: {
  data: Array<{ day: string; value: number }>;
}) {
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-[14px] font-bold text-white tracking-tight mb-0.5">
        Revenue Impact Trend
      </h3>
      <p className="text-[11px] text-slate-500 mb-3">Estimated ₹ at risk · last 7 days</p>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="revGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.primary} stopOpacity={0.5} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: chartTheme.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: chartTheme.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: chartTheme.tooltip.background,
                border: `1px solid ${chartTheme.tooltip.border}`,
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: chartTheme.tooltip.text }}
              formatter={(value) => [
                `₹${Number(value).toLocaleString()}`,
                "At risk",
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8B7FF8"
              strokeWidth={2.75}
              fill="url(#revGlow)"
              filter="url(#glow)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "#C4BBFF",
                stroke: "#6D5DF6",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
