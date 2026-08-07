"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBusinessReviews } from "@/lib/business-api";

interface Review {
  id: string;
  session_id: string;
  raw_text: string;
  rating: number | null;
  source: string;
  review_date: string | null;
  is_spam: boolean;
  is_duplicate: boolean;
  sentiment_label: string | null;
  sentiment_score: number | null;
}

const SENTIMENT_COLOR: Record<string, string> = {
  negative: "text-red-400",
  neutral:  "text-amber-400",
  positive: "text-emerald-400",
};

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-slate-600 text-xs">No rating</span>;
  return (
    <span className="text-xs">
      {"★".repeat(rating)}<span className="text-slate-700">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewRepositoryPage() {
  const params     = useParams();
  const businessId = params.business_id as string;

  const [reviews, setReviews]   = useState<Review[]>([]);
  const [total, setTotal]       = useState(0);
  const [offset, setOffset]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<"all" | "negative" | "spam" | "duplicate">("all");

  const LIMIT = 20;

  const load = async (off = 0) => {
    setLoading(true);
    try {
      const data = await getBusinessReviews(businessId, LIMIT, off);
      setReviews(data.reviews || []);
      setTotal(data.total || 0);
      setOffset(off);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, [businessId]);

  const filtered = reviews.filter(r => {
    if (filter === "negative") return r.sentiment_label === "negative";
    if (filter === "spam")     return r.is_spam;
    if (filter === "duplicate") return r.is_duplicate;
    return true;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📋</span>
            <h1 className="text-xl font-black text-slate-100">Review Repository</h1>
          </div>
          <p className="text-xs text-slate-500">
            All customer feedback imported for this workspace.{" "}
            <span className="text-slate-400 font-semibold">{total.toLocaleString()} total reviews</span>
          </p>
        </div>
        <Link href="/" className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors no-underline">
          ➕ Import More Feedback
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {(["all", "negative", "spam", "duplicate"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all capitalize ${
              filter === f
                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                : "border-white/7 text-slate-400 hover:border-white/15 hover:text-slate-200"
            }`}
          >
            {f === "all" ? `All (${total})` : f === "spam" ? "Spam Filtered" : f === "duplicate" ? "Duplicates" : "Negative"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-slate-500 mt-2">No feedback imported yet. Upload a CSV or import from Play Store.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/8 gap-3">
          <span className="text-4xl">📭</span>
          <p className="text-sm text-slate-400">No reviews in this workspace yet.</p>
          <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300">Upload feedback →</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map(r => (
              <div key={r.id} className={`rounded-2xl border bg-[#0d0f1a] p-4 transition-all ${
                r.is_spam ? "border-red-500/15 opacity-60" : r.is_duplicate ? "border-amber-500/15 opacity-70" : "border-white/7 hover:border-indigo-500/20"
              }`}>
                <div className="flex items-center gap-3 flex-wrap mb-2.5">
                  <StarRating rating={r.rating} />
                  {r.sentiment_label && (
                    <span className={`text-[10px] font-bold ${SENTIMENT_COLOR[r.sentiment_label] || "text-slate-400"}`}>
                      ● {r.sentiment_label}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-600">{r.source}</span>
                  {r.review_date && <span className="text-[10px] text-slate-600">{new Date(r.review_date).toLocaleDateString("en-IN")}</span>}
                  {r.is_spam && <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 text-red-400 text-[9px] font-bold">SPAM</span>}
                  {r.is_duplicate && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[9px] font-bold">DUPLICATE</span>}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{r.raw_text}</p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                disabled={offset === 0}
                onClick={() => load(Math.max(0, offset - LIMIT))}
                className="px-4 py-2 rounded-xl border border-white/8 hover:border-white/15 disabled:opacity-30 text-slate-300 text-xs font-semibold transition-all"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-500">
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                disabled={offset + LIMIT >= total}
                onClick={() => load(offset + LIMIT)}
                className="px-4 py-2 rounded-xl border border-white/8 hover:border-white/15 disabled:opacity-30 text-slate-300 text-xs font-semibold transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
