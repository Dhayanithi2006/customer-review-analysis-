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
