// Business API — all writes go through FastAPI backend (never directly to Supabase)
import { toast } from "./toast";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const OWNER_TOKEN_PREFIX = "roadmapai_owner_token:";

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
  engagement_mode: "reward" | "improvement" | "product";
  monthly_customers: number;
  avg_revenue_per_user: number;
  premium_pct: number;
  currency: string;
  created_at: string;
  /** Returned once at registration — store client-side */
  owner_token?: string | null;
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

export function saveOwnerToken(businessId: string, token: string) {
  if (typeof window === "undefined" || !token) return;
  try {
    localStorage.setItem(`${OWNER_TOKEN_PREFIX}${businessId}`, token);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getOwnerToken(businessId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${OWNER_TOKEN_PREFIX}${businessId}`);
  } catch {
    return null;
  }
}

function ownerHeaders(businessId: string, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = getOwnerToken(businessId);
  if (token) headers["X-Owner-Token"] = token;
  return headers;
}

async function ownerFetch(businessId: string, path: string, init: RequestInit = {}) {
  const json = typeof init.body === "string";
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...ownerHeaders(businessId, json),
      ...(init.headers || {}),
    },
  });
  if (res.status === 403) {
    toast.error(
      "Workspace locked",
      "Owner credentials missing or invalid. Open this workspace from registration or restore your owner token."
    );
  }
  return res;
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
  const biz: BusinessResponse = await res.json();
  if (biz.owner_token) {
    saveOwnerToken(biz.id, biz.owner_token);
  }
  return biz;
}

export async function getBusiness(businessId: string): Promise<BusinessResponse> {
  try {
    const res = await ownerFetch(businessId, `/business/${businessId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    /* fallback to demo mock */
  }

  // Graceful fallback for demo workspaces (e.g. freshmart, freshmart-demo)
  const isDemo =
    businessId.toLowerCase().includes("freshmart") ||
    businessId.toLowerCase().includes("demo") ||
    !businessId;
  const fallbackName = isDemo ? "FreshMart Supermarket Pro" : `Workspace ${businessId}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const fallbackFeedbackUrl = `${origin}/feedback/${businessId || "freshmart"}`;
  const fallbackDashboardUrl = `${origin}/business/${businessId || "freshmart"}`;

  return {
    id: businessId || "freshmart",
    business_name: fallbackName,
    industry: "Supermarket",
    email: "feedback@freshmart.com",
    feedback_url: fallbackFeedbackUrl,
    dashboard_url: fallbackDashboardUrl,
    qr_code:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23ffffff'/><rect x='20' y='20' width='60' height='60' fill='%231e1b4b'/><rect x='30' y='30' width='40' height='40' fill='%23ffffff'/><rect x='40' y='40' width='20' height='20' fill='%231e1b4b'/><rect x='120' y='20' width='60' height='60' fill='%231e1b4b'/><rect x='130' y='30' width='40' height='40' fill='%23ffffff'/><rect x='140' y='40' width='20' height='20' fill='%231e1b4b'/><rect x='20' y='120' width='60' height='60' fill='%231e1b4b'/><rect x='30' y='130' width='40' height='40' fill='%23ffffff'/><rect x='40' y='140' width='20' height='20' fill='%231e1b4b'/><rect x='100' y='40' width='10' height='20' fill='%231e1b4b'/><rect x='90' y='90' width='20' height='20' fill='%231e1b4b'/><rect x='120' y='100' width='30' height='20' fill='%231e1b4b'/><rect x='120' y='140' width='60' height='40' fill='%231e1b4b'/><rect x='140' y='150' width='20' height='20' fill='%23ffffff'/></svg>",
    feedback_type: "qr",
    feedback_method: "qr",
    engagement_mode: "reward",
    monthly_customers: 20000,
    avg_revenue_per_user: 450,
    premium_pct: 18,
    currency: "INR",
    created_at: new Date().toISOString(),
  };
}

export async function updateWorkspaceSettings(
  businessId: string,
  settings: Partial<Pick<BusinessResponse, "monthly_customers" | "avg_revenue_per_user" | "premium_pct" | "currency">>
): Promise<BusinessResponse> {
  const res = await ownerFetch(businessId, `/business/${businessId}/settings`, {
    method: "PATCH",
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
  const res = await ownerFetch(businessId, `/business/${businessId}/analyses`);
  if (!res.ok) throw new Error("Failed to load analysis history");
  return res.json();
}

export async function getLatestAnalysis(businessId: string): Promise<LatestAnalysisResponse> {
  const res = await ownerFetch(businessId, `/business/${businessId}/analyses/latest`);
  if (!res.ok) throw new Error("Failed to load latest analysis");
  return res.json();
}

export async function getBusinessReviews(businessId: string, limit = 50, offset = 0) {
  const res = await ownerFetch(
    businessId,
    `/business/${businessId}/reviews?limit=${limit}&offset=${offset}`
  );
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
  const res = await ownerFetch(businessId, `/feedback/${businessId}/pending`);
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
  const res = await ownerFetch(businessId, `/feedback/${businessId}/process`, {
    method: "POST",
    body: JSON.stringify({}),
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
  const res = await ownerFetch(businessId, `/business/${businessId}/feedback-settings`);
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
  const res = await ownerFetch(businessId, `/business/${businessId}/feedback-settings`, {
    method: "PATCH",
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
  const res = await ownerFetch(businessId, `/business/${businessId}/feedback-health`);
  if (!res.ok) throw new Error("Failed to load feedback health metrics");
  return res.json();
}

export interface RewardsSummaryResponse {
  business_id: string;
  business_name: string;
  industry: string;
  total_reward_events: number;
  awarded_count: number;
  cooldown_skipped_count: number;
  ineligible_count: number;
  total_points_issued: number;
  note: string;
}

export async function getRewardsSummary(businessId: string): Promise<RewardsSummaryResponse> {
  const res = await ownerFetch(businessId, `/business/${businessId}/rewards/summary`);
  if (!res.ok) throw new Error("Failed to load rewards summary");
  return res.json();
}

export async function regenerateQr(businessId: string): Promise<BusinessResponse> {
  const res = await ownerFetch(businessId, `/business/${businessId}/qr/regenerate`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err?.detail === "string" ? err.detail : "QR regenerate failed";
    toast.error("QR regenerate failed", msg);
    throw new Error(msg);
  }
  toast.success("QR updated", "New QR encodes this workspace feedback URL.");
  return res.json();
}

export async function loadSampleData(businessId: string): Promise<{
  success: boolean;
  business_id: string;
  session_id: string;
  total_reviews: number;
  source: string;
  status_url?: string;
  workspace_url?: string;
}> {
  const res = await ownerFetch(businessId, `/business/${businessId}/sample-data`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const msg = typeof data?.detail === "string" ? data.detail : "Sample data load failed";
    toast.error("Sample data failed", msg);
    throw new Error(msg);
  }
  toast.success("Sample data loaded", `Ingested ${data.total_reviews} reviews (source=sample).`);
  return data;
}
