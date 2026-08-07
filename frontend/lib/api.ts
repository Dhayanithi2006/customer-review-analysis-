// Typed API client — all backend calls go through here
import { toast } from "./toast";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// In-memory cache for GET requests
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pathPrefix)) {
      cache.delete(key);
    }
  }
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipCache?: boolean; retries?: number; timeoutMs?: number }
): Promise<T> {
  const method = options?.method?.toUpperCase() || "GET";
  const url = `${BASE_URL}${path}`;
  const retries = options?.retries ?? (method === "GET" ? 2 : 0);
  const timeoutMs = options?.timeoutMs ?? 30000;
  const skipCache = options?.skipCache ?? false;

  // Check cache for GET requests
  if (method === "GET" && !skipCache) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options?.headers },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const errorMessage =
          typeof err?.detail === "string"
            ? err.detail
            : err?.message || `API error ${res.status}`;
        throw new Error(errorMessage);
      }

      const data: T = await res.json();

      // Cache GET results
      if (method === "GET") {
        cache.set(url, { data, timestamp: Date.now() });
      }

      return data;
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const errorMsg = isAbort
        ? "Request timed out after 30 seconds"
        : err instanceof Error
        ? err.message
        : "Network error";

      lastError = new Error(errorMsg);
      attempt++;

      if (attempt <= retries && !isAbort) {
        // Exponential backoff delay
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      } else {
        break;
      }
    }
  }

  throw lastError || new Error("Request failed");
}

// ── Upload CSV ─────────────────────────────────────────────────────────────
export async function uploadCSV(
  file: File,
  source: string,
  teamSize: string
): Promise<{ session_id: string; total_reviews: number; detected_columns: Record<string, string> }> {
  const form = new FormData();
  form.append("file", file);
  form.append("source", source);
  form.append("team_size", teamSize);

  try {
    const res = await fetch(`${BASE_URL}/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err?.detail || err?.message || `Upload failed: ${res.status}`);
    }
    const data = await res.json();
    toast.success("Upload successful!", "Analysis pipeline started in the background.");
    return data;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to upload file";
    toast.error("Upload error", msg);
    throw new Error(msg);
  }
}

// ── Upload Play Store App ─────────────────────────────────────────────────
export async function uploadPlayStore(
  appId: string,
  count: number = 200,
  teamSize: string = "2_5"
): Promise<{ session_id: string; app_id: string; total_reviews: number }> {
  try {
    const data = await apiFetch<{ session_id: string; app_id: string; total_reviews: number }>(
      "/upload/play-store",
      {
        method: "POST",
        body: JSON.stringify({ app_id: appId, count, team_size: teamSize }),
      }
    );
    toast.success("Fetched Play Store reviews!", `Ingested ${data.total_reviews} reviews.`);
    return data;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch Play Store reviews";
    toast.error("Play Store error", msg);
    throw new Error(msg);
  }
}

// ── Pipeline status (polling fallback) ────────────────────────────────────
export async function getPipelineStatus(sessionId: string) {
  return apiFetch<{
    status: string;
    step: number;
    progress: number;
    processed: number;
    total: number;
    message: string;
  }>(`/pipeline/${sessionId}/poll`, { skipCache: true, retries: 1 });
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export async function getDashboard(sessionId: string) {
  return apiFetch<import("./types").DashboardData>(`/results/${sessionId}/dashboard`);
}

// ── Evidence ──────────────────────────────────────────────────────────────
export async function getEvidence(sessionId: string, issueKey: string) {
  return apiFetch<import("./types").EvidenceData>(
    `/results/${sessionId}/evidence/${issueKey}`
  );
}

// ── Roadmap ───────────────────────────────────────────────────────────────
export async function getRoadmap(sessionId: string) {
  return apiFetch<{ roadmap: import("./types").RoadmapWeek[] }>(
    `/results/${sessionId}/roadmap`
  );
}

// ── Sprint ────────────────────────────────────────────────────────────────
export async function getSprint(sessionId: string) {
  return apiFetch<{ sprint: import("./types").Sprint }>(`/results/${sessionId}/sprint`);
}

// ── Meeting ───────────────────────────────────────────────────────────────
export async function getSmartQuestions(sessionId: string): Promise<string[]> {
  const r = await apiFetch<{ questions: string[] }>(`/meeting/${sessionId}/questions`);
  return r.questions;
}

export async function sendMeetingMessage(
  sessionId: string,
  message: string
): Promise<{ reply: string; referenced_issues: string[] }> {
  return apiFetch(`/meeting/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ── Decision Log / History ────────────────────────────────────────────────
export async function getSessionHistory() {
  return apiFetch<{ sessions: import("./types").Session[] }>(`/results/history`, { skipCache: true });
}

// ── Export URLs ───────────────────────────────────────────────────────────
export const exportUrls = {
  sprint: (sid: string) => `${BASE_URL}/export/${sid}/sprint`,
  roadmap: (sid: string) => `${BASE_URL}/export/${sid}/roadmap`,
};
