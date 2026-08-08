"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ResolutionItem {
  id: string;
  issue_key: string;
  status: "Open" | "Investigating" | "Planned" | "In Progress" | "Resolved";
  you_said: string;
  we_did?: string;
  updated_at: string;
  resolved_at?: string;
}

interface PublicUpdatesResponse {
  business_id: string;
  business_name: string;
  updates: ResolutionItem[];
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; icon: string }> = {
  Resolved:      { label: "Resolved",      bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", icon: "✓" },
  "In Progress": { label: "In Progress",   bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400",    icon: "⚡" },
  Planned:       { label: "Planned",       bg: "bg-purple-500/10",  border: "border-purple-500/25",  text: "text-purple-400",  icon: "🗺️" },
  Investigating: { label: "Investigating", bg: "bg-amber-500/10",   border: "border-amber-500/25",   text: "text-amber-400",   icon: "🔍" },
  Open:          { label: "Logged",        bg: "bg-slate-500/10",   border: "border-slate-500/25",   text: "text-slate-400",   icon: "📬" },
};

export default function PublicFeedbackUpdatesPage() {
  const params     = useParams();
  const businessId = params.business_id as string;

  const [data, setData]       = useState<PublicUpdatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>("All");

  useEffect(() => {
    fetch(`${API}/feedback/${businessId}/updates`)
      .then(r => r.json())
      .then(d => { if (d && d.updates) setData(d); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Loading community updates…</p>
      </div>
    </div>
  );

  const updates = data?.updates || [];
  const filteredUpdates = filter === "All"
    ? updates
    : updates.filter(u => u.status === filter);

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 relative">
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/3 to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto px-4 py-8 sm:py-12">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/6 border border-white/10 mb-4">
            <span className="text-sm">📣</span>
            <span className="text-xs font-bold text-slate-200">{data?.business_name || "Community Updates"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight">
            You Said → We Did
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            See how customer feedback directly leads to real improvements at {data?.business_name}.
          </p>
        </div>

        {/* Filter Bar */}
        {updates.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap mb-6">
            {["All", "Resolved", "In Progress", "Planned", "Investigating"].map(status => {
              const active = filter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    active
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "border-white/8 bg-[#0d0f1a] text-slate-400 hover:border-white/20"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        )}

        {/* Updates Feed */}
        {filteredUpdates.length === 0 ? (
          <div className="bg-[#0d0f1a]/95 border border-white/8 rounded-3xl p-8 text-center space-y-3">
            <p className="text-3xl">🌱</p>
            <p className="text-sm font-bold text-slate-200">No public action updates yet</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              Our team is currently reviewing recent feedback items and will publish resolution actions here.
            </p>
            <div className="pt-2">
              <Link
                href={`/feedback/${businessId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors no-underline"
              >
                Submit Feedback
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUpdates.map(item => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.Open;
              const dateStr = item.resolved_at || item.updated_at;
              const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric"
              }) : "";

              return (
                <div key={item.id} className="bg-[#0d0f1a]/95 border border-white/8 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4">

                  {/* Header Status Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </div>
                    {formattedDate && (
                      <span className="text-[10px] text-slate-500 font-mono">{formattedDate}</span>
                    )}
                  </div>

                  {/* YOU SAID Block */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/6 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      You Said
                    </p>
                    <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                      "{item.you_said}"
                    </p>
                  </div>

                  {/* WE DID Block */}
                  {item.we_did && (
                    <div className="p-3.5 rounded-2xl bg-indigo-500/8 border border-indigo-500/20 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        We Did
                      </p>
                      <p className="text-xs sm:text-sm text-indigo-100 font-semibold leading-relaxed">
                        {item.we_did}
                      </p>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* Return Button */}
        <div className="mt-8 text-center space-y-3">
          <Link
            href={`/feedback/${businessId}`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/6 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold transition-all no-underline"
          >
            ← Give Customer Feedback
          </Link>
          <p className="text-[10px] text-slate-600">
            {data?.business_name} Feedback Closure Loop — Powered by <span className="text-slate-400 font-semibold">RoadmapAI</span>
          </p>
        </div>

      </div>
    </div>
  );
}
