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
  revenue_pct: number;
  reach_pct: number;
  severity_pct: number;
  premium_pct: number;
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
  platforms: string[];
  sample_reviews: string[];
  decision_pillars?: DecisionPillars;
}

export interface DashboardData {
  session_id: string;
  total_reviews: number;
  actionable_reviews: number;
  revenue_at_risk: number;
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
}

export interface EvidenceData {
  issue_key: string;
  category: string;
  business_area: string;
  description: string;
  confidence: number;
  review_count: number;
  premium_user_count: number;
  revenue_at_risk: number;
  avg_severity: number;
  priority_rank: number;
  platforms: string[];
  sample_reviews: string[];
}

export interface RoadmapWeek {
  week: number;
  theme: string;
  issues: string[];
  effort: "Quick Win" | "Medium" | "Large";
  rationale: string;
}

export interface SprintStory {
  id: string;
  title: string;
  user_story: string;
  acceptance_criteria: string[];
  effort: "S" | "M" | "L";
  story_points: number;
  priority: "High" | "Medium" | "Low";
  linked_issue: string;
}

export interface Sprint {
  name: string;
  owner: string;
  duration_weeks: number;
  total_story_points: number;
  stories: SprintStory[];
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
