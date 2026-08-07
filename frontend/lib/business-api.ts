// Business API functions
import { toast } from "./toast";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface BusinessResponse {
  id: string;
  business_name: string;
  industry: string;
  email: string;
  feedback_url: string;
  qr_code: string | null;
  feedback_type: "qr" | "digital";
  created_at: string;
}

export async function registerBusiness(payload: {
  business_name: string;
  industry: string;
  email: string;
}): Promise<BusinessResponse> {
  const res = await fetch(`${BASE_URL}/business/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg =
      typeof err?.detail === "string" ? err.detail : "Registration failed";
    toast.error("Registration failed", msg);
    throw new Error(msg);
  }
  const data: BusinessResponse = await res.json();
  toast.success("Workspace created!", `Welcome to RoadmapAI, ${payload.business_name}`);
  return data;
}

export async function getBusiness(businessId: string): Promise<BusinessResponse> {
  const res = await fetch(`${BASE_URL}/business/${businessId}`);
  if (!res.ok) throw new Error("Business not found");
  return res.json();
}
