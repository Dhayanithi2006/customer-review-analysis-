"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { getBusinessReviews, getLatestAnalysis } from "@/lib/business-api";
import { getDashboard } from "@/lib/api";
import type { IssueCluster } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import { WorkspacePage } from "@/components/layout/workspace-page";

/* ── types ─────────────────────────────────────────────────────────────── */

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
  customer_email?: string | null;
  follow_up_eligible?: boolean;
  follow_up_sent?: boolean;
  followup_response?: string | null;
}

interface EnrichedReview extends Review {
  cluster: IssueCluster | null;
  priority: "Critical" | "High" | "Medium" | "Low" | null;
  confidence: number | null;
  aiSummary: string | null;
  keywords: string[];
}

type DateFilter = "all" | "7d" | "30d" | "90d";
type PriorityFilter = "all" | "Critical" | "High" | "Medium" | "Low";

const LIMIT = 150;

/* ── helpers ───────────────────────────────────────────────────────────── */

function issueTitle(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function keywordsFromCluster(cluster: IssueCluster) {
  return Array.from(
    new Set(
      cluster.issue_key
        .split("_")
        .filter((w) => w.length > 3)
        .map((w) => w.toLowerCase())
    )
  ).slice(0, 6);
}

function priorityFromRank(rank: number): EnrichedReview["priority"] {
  if (rank <= 1) return "Critical";
  if (rank <= 3) return "High";
  if (rank <= 6) return "Medium";
  return "Low";
}

function matchCluster(review: Review, clusters: IssueCluster[]): IssueCluster | null {
  if (!clusters.length) return null;
  const text = (review.raw_text || "").toLowerCase();

  // Exact sample match first
  for (const c of clusters) {
    for (const sample of c.sample_reviews || []) {
      if (!sample) continue;
      if (text === sample.toLowerCase() || text.includes(sample.toLowerCase().slice(0, 48))) {
        return c;
      }
    }
  }

  // Keyword overlap scoring
  let best: IssueCluster | null = null;
  let bestScore = 0;
  for (const c of clusters) {
    const words = keywordsFromCluster(c);
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = c;
    }
  }
  return bestScore >= 1 ? best : null;
}

function enrichReviews(reviews: Review[], clusters: IssueCluster[]): EnrichedReview[] {
  return reviews.map((r) => {
    const cluster = matchCluster(r, clusters);
    const rank = cluster?.priority_rank || 99;
    return {
      ...r,
      cluster,
      priority: cluster ? priorityFromRank(rank) : null,
      confidence: cluster
        ? Math.round((cluster.avg_confidence || 0.85) * 100)
        : r.sentiment_score != null
        ? Math.round(Math.abs(r.sentiment_score) * 100)
        : null,
      aiSummary: cluster?.description || null,
      keywords: cluster ? keywordsFromCluster(cluster) : [],
    };
  });
}

function highlightText(text: string, keywords: string[]) {
  if (!keywords.length) return [{ text, hit: false }];
  const escaped = keywords
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(re).map((part) => ({
    text: part,
    hit: escaped.some((k) => part.toLowerCase() === k.toLowerCase()),
  }));
}

function withinDate(iso: string | null, filter: DateFilter) {
  if (filter === "all" || !iso) return filter === "all" ? true : false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[filter];
  const cutoff = Date.now() - days * 86400000;
  return d.getTime() >= cutoff;
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) {
    return <span className="text-[11px] text-slate-600 font-medium">No rating</span>;
  }
  return (
    <span className="text-xs tracking-tight" aria-label={`${rating} of 5 stars`}>
      <span className="text-amber-400">{"★".repeat(rating)}</span>
      <span className="text-slate-700">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function sentimentVariant(
  label: string | null
): "danger" | "warning" | "success" | "default" {
  if (label === "negative") return "danger";
  if (label === "neutral") return "warning";
  if (label === "positive") return "success";
  return "default";
}

function priorityVariant(
  p: EnrichedReview["priority"]
): "danger" | "warning" | "primary" | "default" {
  if (p === "Critical") return "danger";
  if (p === "High") return "warning";
  if (p === "Medium") return "primary";
  return "default";
}

function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "—";
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

/* ── expandable card ───────────────────────────────────────────────────── */

function ReviewCard({ review }: { review: EnrichedReview }) {
  const [open, setOpen] = useState(false);
  const parts = highlightText(review.raw_text || "", review.keywords);

  return (
    <article
      className={cn(
        "rounded-[18px] border bg-surface transition-all duration-200",
        "shadow-[0_2px_12px_rgba(0,0,0,0.2)]",
        review.is_spam
          ? "border-red-500/15 opacity-70"
          : review.is_duplicate
          ? "border-amber-500/15"
          : open
          ? "border-primary/30"
          : "border-border hover:border-white/[0.12]"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 md:px-6 md:py-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              <StarRating rating={review.rating} />
              {review.sentiment_label && (
                <Badge variant={sentimentVariant(review.sentiment_label)}>
                  {review.sentiment_label}
                </Badge>
              )}
              <Badge variant="outline">{review.source || "Unknown"}</Badge>
              {review.cluster && (
                <Badge variant="primary">{issueTitle(review.cluster.issue_key)}</Badge>
              )}
              {review.priority && (
                <Badge variant={priorityVariant(review.priority)}>{review.priority}</Badge>
              )}
              {review.customer_email && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-500/10 text-purple-300 border-purple-500/20">
                  Email: {maskEmail(review.customer_email)}
                </span>
              )}
              {review.follow_up_sent && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                  Follow-up: Sent
                </span>
              )}
              {review.followup_response && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/20 capitalize">
                  Response: {review.followup_response.replace("_", " ")}
                </span>
              )}
              {review.is_spam && <Badge variant="danger">Spam</Badge>}
              {review.is_duplicate && <Badge variant="warning">Duplicate</Badge>}
            </div>

            <p
              className={cn(
                "text-sm text-slate-200 leading-relaxed",
                !open && "line-clamp-2"
              )}
            >
              {open
                ? parts.map((p, i) =>
                    p.hit ? (
                      <mark
                        key={i}
                        className="bg-primary/25 text-[#E4DFFF] rounded px-0.5"
                      >
                        {p.text}
                      </mark>
                    ) : (
                      <span key={i}>{p.text}</span>
                    )
                  )
                : review.raw_text}
            </p>

            <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500 flex-wrap">
              {review.review_date && (
                <span>
                  {new Date(review.review_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              {review.confidence != null && (
                <span className="font-mono">Confidence {review.confidence}%</span>
              )}
              {!open && review.aiSummary && (
                <span className="text-slate-600 truncate max-w-[240px]">
                  AI · {review.aiSummary}
                </span>
              )}
            </div>
          </div>

          <span className="shrink-0 mt-1 text-slate-500">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-4 border-t border-white/[0.05] pt-4 animate-fade-in">
          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Rating", value: review.rating ? `${review.rating} / 5` : "—" },
              { label: "Source", value: review.source || "—" },
              {
                label: "Cluster",
                value: review.cluster ? issueTitle(review.cluster.issue_key) : "Unclustered",
              },
              {
                label: "Sentiment",
                value: review.sentiment_label || "—",
              },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3 py-2.5"
              >
                <p className="text-[10px] text-slate-600 font-semibold mb-1">{cell.label}</p>
                <p className="text-xs font-bold text-slate-200 truncate">{cell.value}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold mb-1.5">
                Confidence
              </p>
              <p className="text-sm font-bold font-mono text-primary-soft">
                {review.confidence != null ? `${review.confidence}%` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold mb-1.5">
                Priority
              </p>
              <p className="text-sm font-bold text-slate-200">
                {review.priority || "Unranked"}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold mb-1.5">
              AI Summary
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {review.aiSummary ||
                (review.sentiment_label
                  ? `${review.sentiment_label.charAt(0).toUpperCase()}${review.sentiment_label.slice(1)} customer feedback from ${review.source || "import"}.`
                  : "No cluster summary available for this review yet.")}
            </p>
          </div>

          {review.keywords.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold mb-2">
                Evidence highlight
              </p>
              <div className="flex flex-wrap gap-1.5">
                {review.keywords.map((k) => (
                  <span
                    key={k}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/15 text-primary-soft-2 border border-primary/25"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function ReviewRepositoryPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [sentiment, setSentiment] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [clusterKey, setClusterKey] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBusinessReviews(businessId, LIMIT, 0);
      setReviews(data.reviews || []);
      setTotal(data.total || 0);

      try {
        const latest = await getLatestAnalysis(businessId);
        if (latest.has_analysis && latest.session_id) {
          const dash = await getDashboard(latest.session_id);
          setClusters(dash.issues || []);
        }
      } catch {
        /* enrichment optional */
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const enriched = useMemo(
    () => enrichReviews(reviews, clusters),
    [reviews, clusters]
  );

  const sources = useMemo(() => {
    const set = new Set(reviews.map((r) => r.source).filter(Boolean));
    return Array.from(set).sort();
  }, [reviews]);

  const clusterOptions = useMemo(() => {
    return clusters
      .slice()
      .sort((a, b) => (a.priority_rank || 99) - (b.priority_rank || 99))
      .map((c) => ({ key: c.issue_key, label: issueTitle(c.issue_key) }));
  }, [clusters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      if (q) {
        const hay = [
          r.raw_text,
          r.source,
          r.sentiment_label,
          r.cluster?.issue_key,
          r.aiSummary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sentiment !== "all" && r.sentiment_label !== sentiment) return false;
      if (source !== "all" && r.source !== source) return false;
      if (!withinDate(r.review_date, dateFilter)) return false;
      if (priority !== "all" && r.priority !== priority) return false;
      if (clusterKey !== "all" && r.cluster?.issue_key !== clusterKey) return false;
      return true;
    });
  }, [enriched, search, sentiment, source, dateFilter, priority, clusterKey]);

  const activeFilterCount = [
    sentiment !== "all",
    source !== "all",
    dateFilter !== "all",
    priority !== "all",
    clusterKey !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSentiment("all");
    setSource("all");
    setDateFilter("all");
    setPriority("all");
    setClusterKey("all");
    setSearch("");
  };

  const selectClass =
    "h-10 rounded-[14px] border border-white/[0.08] bg-surface-2 px-3 text-xs font-medium text-slate-200 outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(109,93,246,0.18)] transition-all";

  return (
    <WorkspacePage>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            Review Repository
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Customer feedback archive
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            <span className="text-slate-300 font-semibold">{total.toLocaleString()}</span>{" "}
            reviews across this workspace
            {filtered.length !== enriched.length && (
              <>
                <span className="text-slate-700 mx-1.5">·</span>
                <span>{filtered.length} matching</span>
              </>
            )}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/">Import feedback</Link>
        </Button>
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews, clusters, sources…"
            className="pl-10 h-11"
          />
        </div>
        <Button
          type="button"
          variant={showFilters ? "secondary" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          className="shrink-0"
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="rounded-[18px] border border-border bg-surface p-4 md:p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Advanced filters
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                <X size={12} /> Clear all
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Sentiment
              </span>
              <select
                className={selectClass}
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value)}
              >
                <option value="all">All sentiments</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
                <option value="positive">Positive</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Source
              </span>
              <select
                className={selectClass}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="all">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Date
              </span>
              <select
                className={selectClass}
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              >
                <option value="all">Any time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Priority
              </span>
              <select
                className={selectClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityFilter)}
              >
                <option value="all">All priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Cluster
              </span>
              <select
                className={selectClass}
                value={clusterKey}
                onChange={(e) => setClusterKey(e.target.value)}
              >
                <option value="all">All clusters</option>
                {clusterOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-4" aria-busy="true" aria-label="Loading reviews">
          <ContentSkeleton variant="list" />
        </div>
      ) : error ? (
        <EmptyState
          title="Couldn’t load reviews"
          description={error}
          action={{ label: "Try again", onClick: () => load() }}
          secondaryAction={{ label: "Import feedback", onClick: () => { window.location.href = "/"; } }}
        />
      ) : enriched.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Import customer feedback to populate the repository."
          action={{ label: "Import feedback", href: "/" }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching reviews"
          description="Try clearing filters or adjusting your search."
          action={{ label: "Clear filters", onClick: clearFilters }}
          compact
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}

          {total > LIMIT && (
            <p className="text-center text-xs text-slate-600 pt-4">
              Showing {enriched.length} of {total.toLocaleString()} reviews
            </p>
          )}
        </div>
      )}
    </WorkspacePage>
  );
}
