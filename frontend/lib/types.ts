// Shared TypeScript types across the entire frontend

export interface Session {
  id: string;
  filename: string;
  source: string;
  team_size: string;
  status: string;
  total_reviews: number;
  actionable_reviews: number;
  created_at: string;
}

export interface DecisionPillars {
  revenue_impact: number;
  customer_reach: number;
  severity: number;
  premium_users: number;
  customer_tier?: number;
  revenue_pct: number;
  reach_pct: number;
  severity_pct: number;
  premium_pct: number;
  revenue_weighted?: number;
  reach_weighted?: number;
  severity_weighted?: number;
  tier_weighted?: number;
  estimated_revenue_impact?: number;
  affected_customers?: number;
  affected_customers_label?: string;
  customer_reach_percentage?: number;
  severity_risk_factor?: number;
  formula?: string;
  revenue_formula?: string;
  weights?: {
    revenue: number;
    customer_reach: number;
    severity: number;
    customer_tier: number;
  };
}

export interface IssueCluster {
  id: string;
  session_id: string;
  issue_key: string;
  category: string;
  business_area: string;
  description: string;
  review_count: number;
  avg_severity: number;
  avg_confidence: number;
  avg_sentiment: number;
  premium_user_count: number;
  priority_score: number;
  priority_rank: number;
  revenue_at_risk: number;
  estimated_revenue_impact?: number;
  affected_customers?: number;
  customer_reach_percentage?: number;
  platforms: string[];
  sample_reviews: string[];
  decision_pillars?: DecisionPillars;
  reports?: number;
  confidence?: number;
  recommendation?: string;
}

export interface DecisionCenterKpis {
  total_estimated_revenue_impact: number;
  revenue_at_risk_critical_high: number;
  customers_affected: number;
  critical_issue_count: number;
  issue_count?: number;
}

export interface BusinessAssumptionsPayload {
  monthly_customers?: number | null;
  avg_revenue_per_user?: number | null;
  premium_pct?: number | null;
  currency?: string;
  configured?: boolean;
  business_id?: string | null;
  edit_path?: string | null;
  disclaimer?: string;
}

export interface DashboardData {
  session_id: string;
  source?: string;
  filename?: string;
  is_demo_data?: boolean;
  total_reviews: number;
  actionable_reviews: number;
  revenue_at_risk: number;
  estimated_revenue_impact_total?: number;
  top_priority_issue: IssueCluster | null;
  most_requested_feature: IssueCluster | null;
  executive_summary: string;
  headline_insights: string[];
  ai_recommendation: string;
  issues: IssueCluster[];
  analysis_health?: {
    quality_score: number;
    total_processed: number;
    spam_skipped: number;
    duplicates_removed: number;
    ai_confidence: number;
  };
  kpis?: DecisionCenterKpis;
  fix_first?: {
    issue_key?: string;
    title?: string;
    why?: string;
    recommendation?: string;
    estimated_revenue_impact?: number;
    affected_customers?: number;
    priority_score?: number;
  } | null;
  business_assumptions?: BusinessAssumptionsPayload;
  sentiment_distribution?: {
    positive_pct: number;
    neutral_pct: number;
    negative_pct: number;
    total?: number;
  };
  decision_center?: {
    kpis?: DecisionCenterKpis;
    fix_first?: DashboardData["fix_first"];
    business_assumptions?: BusinessAssumptionsPayload;
    sentiment_distribution?: DashboardData["sentiment_distribution"];
    empty_state?: {
      code?: string;
      message?: string;
      actions?: string[];
    } | null;
    headline?: string;
    supporting?: string;
    priority_matrix?: Array<{
      issue_key: string;
      revenue: number;
      reach: number;
    }>;
  };
}

export interface EvidenceData {
  issue_key: string;
  category: string;
  business_area: string;
  description: string;
  confidence: number;
  review_count: number;
  affected_customers?: number;
  premium_user_count: number;
  revenue_at_risk: number;
  avg_severity: number;
  avg_sentiment?: number;
  priority_rank: number;
  priority_score?: number;
  priority_components?: DecisionPillars | Record<string, unknown>;
  platforms: string[];
  sources?: string[];
  sample_reviews: string[];
  representative_comments?: Array<{
    text: string;
    source?: string;
    sentiment?: string;
    sentiment_score?: number;
    severity?: number;
    rating?: number | null;
  }>;
  severity?: number;
  sentiment?: number;
}

export interface RoadmapWeek {
  week: number;
  theme: string;
  issues: string[];
  effort: "Quick Win" | "Medium" | "Large" | string;
  rationale: string;
  expected_outcome?: string;
  effort_estimate?: string;
  effort_is_estimate?: boolean;
}

export interface RoadmapItem {
  issue: string;
  issue_key?: string;
  priority: string;
  priority_rank?: number;
  priority_score?: number;
  recommended_action: string;
  expected_business_outcome: string;
  suggested_timeframe: string;
  category?: string;
  review_count?: number;
  avg_severity?: number;
  revenue_at_risk?: number;
}

export interface SprintStory {
  id: string;
  title: string;
  user_story: string;
  acceptance_criteria: string[];
  effort: "S" | "M" | "L" | string;
  effort_estimate?: string;
  effort_is_estimate?: boolean;
  story_points: number;
  story_points_note?: string;
  priority: "High" | "Medium" | "Low" | "Critical" | string;
  linked_issue: string;
}

export interface Sprint {
  name: string;
  owner: string;
  duration_weeks: number;
  total_story_points: number;
  effort_disclaimer?: string;
  stories: SprintStory[];
}

export interface AiPmBriefing {
  issue?: string | null;
  issue_key?: string;
  why_it_matters: string;
  why_prioritized: string;
  if_ignored: string;
  recommended_next_action: string;
  metrics?: Record<string, unknown>;
}

export interface PipelineStatus {
  status: string;
  step: number;
  progress: number;
  processed: number;
  total: number;
  message: string;
}

export interface MeetingMessage {
  role: "ai" | "user";
  content: string;
  referenced_issues?: string[];
  timestamp: number;
}

export type CategoryType =
  | "Bug" | "Performance" | "UX" | "Pricing"
  | "Feature Request" | "Onboarding" | "Customer Support"
  | "Data & Privacy" | "Integration" | "Praise";
