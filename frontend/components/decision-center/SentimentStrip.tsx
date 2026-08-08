"use client";

interface SentimentDistribution {
  positive_pct?: number;
  neutral_pct?: number;
  negative_pct?: number;
  total?: number;
}

interface SentimentStripProps {
  sentiment?: SentimentDistribution | null;
}

export function SentimentStrip({ sentiment }: SentimentStripProps) {
  if (!sentiment || !sentiment.total) {
    return null;
  }

  const pos = sentiment.positive_pct ?? 0;
  const neu = sentiment.neutral_pct ?? 0;
  const neg = sentiment.negative_pct ?? 0;

  return (
    <section className="mb-8">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">
          Sentiment (VADER)
        </p>
        <h3 className="text-lg font-extrabold text-white tracking-tight">
          Feedback tone distribution
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Negative sentiment alone does not auto-rank an issue highest — priority uses revenue, reach, severity, and tier.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
        <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.06]">
          <div className="bg-emerald-500/80" style={{ width: `${pos}%` }} title={`Positive ${pos}%`} />
          <div className="bg-slate-500/70" style={{ width: `${neu}%` }} title={`Neutral ${neu}%`} />
          <div className="bg-red-500/80" style={{ width: `${neg}%` }} title={`Negative ${neg}%`} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500/80" /> Positive {pos}%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500/70" /> Neutral {neu}%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500/80" /> Negative {neg}%
          </span>
          <span className="text-slate-600 font-mono ml-auto">{sentiment.total} reviews</span>
        </div>
      </div>
    </section>
  );
}
