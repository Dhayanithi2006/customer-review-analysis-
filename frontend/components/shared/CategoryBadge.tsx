import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

type CategoryVariant = BadgeProps["variant"];

const CATEGORY_MAP: Record<string, CategoryVariant> = {
  "Bug":               "bug",
  "Performance":       "perf",
  "UX":                "ux",
  "Feature Request":   "feature",
  "Praise":            "praise",
  "Pricing":           "pricing",
  "Onboarding":        "onboarding",
  "Customer Support":  "support",
  "Data & Privacy":    "privacy",
  "Integration":       "integration",
};

export function CategoryBadge({ category }: { category: string }) {
  const variant = CATEGORY_MAP[category] || "default";
  return <Badge variant={variant}>{category}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, CategoryVariant> = {
    Critical: "danger",
    High: "high",
    Medium: "medium",
    Low: "low",
  };
  return <Badge variant={map[priority] || "default"}>{priority}</Badge>;
}

export function EffortBadge({ effort }: { effort: string }) {
  const map: Record<string, CategoryVariant> = { "Quick Win": "quickwin", "Medium": "medium", "Large": "high" };
  return <Badge variant={map[effort] || "default"}>⏱ {effort}</Badge>;
}
