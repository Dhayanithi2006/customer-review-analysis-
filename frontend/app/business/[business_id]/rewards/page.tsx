"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Gift } from "lucide-react";
import { getRewardsSummary, type RewardsSummaryResponse } from "@/lib/business-api";
import { ContentSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage, PageIntro } from "@/components/layout/workspace-page";

export default function RewardsPage() {
  const params = useParams();
  const businessId = params.business_id as string;
  const [summary, setSummary] = useState<RewardsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRewardsSummary(businessId)
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) {
    return (
      <WorkspacePage>
        <ContentSkeleton />
      </WorkspacePage>
    );
  }

  if (error || !summary) {
    return (
      <WorkspacePage>
        <EmptyState
          title="Rewards unavailable"
          description={error || "Could not load reward aggregates for this workspace."}
        />
      </WorkspacePage>
    );
  }

  const cards = [
    { label: "Points issued", value: summary.total_points_issued },
    { label: "Rewards awarded", value: summary.awarded_count },
    { label: "Cooldown skipped", value: summary.cooldown_skipped_count },
    { label: "Ineligible", value: summary.ineligible_count },
  ];

  return (
    <WorkspacePage>
      <PageIntro
        eyebrow="Incentives"
        title="Rewards"
        description="Business-funded loyalty aggregates only. Customer wallets and contact details stay private."
      />

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-5"
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-white tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02] p-5 flex gap-3">
        <Gift className="size-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-slate-300">{summary.note}</p>
          <p className="mt-2 text-xs text-slate-500">
            Configure points, cooldown (24h / 7d / 30d / 90d / custom), and mode under Settings.
            Reward mode defaults on for transactional industries; disabled for hospital, school,
            university, institute, and bank.
          </p>
        </div>
      </div>
    </WorkspacePage>
  );
}
