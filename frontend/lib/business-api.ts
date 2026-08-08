// Business API — all writes go through FastAPI backend (never directly to Supabase)
import { toast } from "./toast";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface BusinessResponse {
  id: string;
  business_name: string;
  industry: string;
  email: string;
  feedback_url: string;
  dashboard_url: string;
  qr_code: string | null;
  feedback_type: "qr" | "digital";
  feedback_method: string;
  engagement_mode: "reward" | "improvement" | "product";  // Feedback Engagement Layer
  monthly_customers: number;
  avg_revenue_per_user: number;
  premium_pct: number;
  currency: string;
  created_at: string;
}

export interface RegisterPayload {
  business_name: string;
  industry: string;
  email: string;
  feedback_method: string;
  monthly_customers: number;
  avg_revenue_per_user: number;
  premium_pct: number;
  currency: string;
}

export async function registerBusiness(payload: RegisterPayload): Promise<BusinessResponse> {
  const res = await fetch(`${BASE_URL}/business/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err?.detail === "string" ? err.detail : "Registration failed";
    toast.error("Registration failed", msg);
    throw new Error(msg);
  }
  return res.json();
}

export async function getBusiness(businessId: string): Promise<BusinessResponse> {
  const res = await fetch(`${BASE_URL}/business/${businessId}`);
  if (!res.ok) throw new Error("Business not found");
  return res.json();
}

export async function updateWorkspaceSettings(
  businessId: string,
  settings: Partial<Pick<BusinessResponse, "monthly_customers" | "avg_revenue_per_user" | "premium_pct" | "currency">>
): Promise<BusinessResponse> {
  const res = await fetch(`${BASE_URL}/business/${businessId}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail || "Settings update failed");
  }
  toast.success("Settings saved", "Workspace revenue settings updated.");
  return res.json();
}

export interface AnalysisVersion {
  id: string;
  business_id: string;
  session_id: string;
  version: number;
  label: string;
  status: string;
  total_reviews: number;
  actionable_reviews: number;
  source: string;
  filename: string;
  created_at: string;
}

export interface AnalysesResponse {
  business_id: string;
  business_name: string;
  total_analyses: number;
  analyses: AnalysisVersion[];
}

export interface LatestAnalysisResponse {
  has_analysis: boolean;
  session_id: string | null;
  version: number | null;
  label: string | null;
  status?: string;
  created_at?: string;
  total_reviews?: number;
  actionable_reviews?: number;
  message?: string;
}

export async function getBusinessAnalyses(businessId: string): Promise<AnalysesResponse> {
  const res = await fetch(`${BASE_URL}/business/${businessId}/analyses`);
  if (!res.ok) throw new Error("Failed to load analysis history");
  return res.json();
}

export async function getLatestAnalysis(businessId: string): Promise<LatestAnalysisResponse> {
  const res = await fetch(`${BASE_URL}/business/${businessId}/analyses/latest`);
  if (!res.ok) throw new Error("Failed to load latest analysis");
  return res.json();
}

export async function getBusinessReviews(businessId: string, limit = 50, offset = 0) {
  const res = await fetch(`${BASE_URL}/business/${businessId}/reviews?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Failed to load reviews");
  return res.json();
}

// ── Feedback Engagement Layer ─────────────────────────────────────────────────

export interface FeedbackSubmission {
  id: string;
  raw_text: string;
  rating: number | null;
  engagement_mode: string;
  feedback_tag: string | null;
  submitted_at: string;
}

export interface PendingSubmissionsResponse {
  business_id: string;
  business_name: string;
  total_pending: number;
  total_all_time: number;
  samples: FeedbackSubmission[];
  ready_to_analyse: boolean;
  message: string;
}

export async function getPendingSubmissions(businessId: string): Promise<PendingSubmissionsResponse> {
  const res = await fetch(`${BASE_URL}/feedback/${businessId}/pending`);
  if (!res.ok) throw new Error("Failed to load pending submissions");
  return res.json();
}

export async function processSubmissions(businessId: string): Promise<{
  success: boolean;
  session_id: string | null;
  total_processed: number;
  message: string;
  status_url?: string;
  workspace_url?: string;
}> {
  const res = await fetch(`${BASE_URL}/feedback/${businessId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Processing failed");
  }
  toast.success("Analysis started!", `Processing ${data.total_processed} form submissions.`);
  return data;
}

export interface FeedbackEngagementSettings {
  id: string;
  business_id: string;
  feedback_mode: "reward" | "improvement" | "product";
  reward_enabled: boolean;
  points_per_feedback: number;
  cooldown_hours: number;
  minimum_feedback_length: number;
  reward_threshold: number;
  reward_description: string;
  feedback_message: string;
  mode_label?: string;
  mode_icon?: string;
  created_at: string;
  updated_at: string;
}

export async function getFeedbackSettings(businessId: string): Promise<FeedbackEngagementSettings> {
  const res = await fetch(`${BASE_URL}/business/${businessId}/feedback-settings`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to load feedback settings" }));
    throw new Error(err?.detail || "Failed to load feedback settings");
  }
  return res.json();
}

export async function updateFeedbackSettings(
  businessId: string,
  settings: Partial<Omit<FeedbackEngagementSettings, "id" | "business_id" | "created_at" | "updated_at">>
): Promise<FeedbackEngagementSettings> {
  const res = await fetch(`${BASE_URL}/business/${businessId}/feedback-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update feedback settings" }));
    toast.error("Settings update failed", err?.detail || "Could not update feedback settings.");
    throw new Error(err?.detail || "Failed to update feedback settings");
  }
  toast.success("Settings saved", "Feedback engagement settings updated successfully.");
  return res.json();
}

export interface FeedbackHealthResponse {
  business_id: string;
  total_feedback: number;
  feedback_this_week: number;
  engagement_mode: string;
  points_issued: number;
  top_source: string;
  most_repeated_issue: string;
  sentiment_distribution: {
    negative_pct: number;
    positive_pct: number;
    neutral_pct: number;
  };
}

export async function getFeedbackHealth(businessId: string): Promise<FeedbackHealthResponse> {
  const res = await fetch(`${BASE_URL}/business/${businessId}/feedback-health`);
  if (!res.ok) throw new Error("Failed to load feedback health metrics");
  return res.json();
}

