// Typed API client — all backend calls go through here

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Upload ────────────────────────────────────────────────────────────────
export async function uploadCSV(
  file: File,
  source: string,
  teamSize: string
): Promise<{ session_id: string; total_reviews: number; detected_columns: Record<string, string> }> {
  const form = new FormData();
  form.append("file", file);
  form.append("source", source);
  form.append("team_size", teamSize);

  const res = await fetch(`${BASE_URL}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// ── Pipeline status (polling) ─────────────────────────────────────────────
export async function getPipelineStatus(sessionId: string) {
  return apiFetch<{
    status: string;
    step: number;
    progress: number;
    processed: number;
    total: number;
    message: string;
  }>(`/pipeline/${sessionId}/poll`);
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

// ── Decision Log ──────────────────────────────────────────────────────────
export async function getSessionHistory() {
  return apiFetch<{ sessions: import("./types").Session[] }>(`/results/history`);
}

// ── Export URLs ───────────────────────────────────────────────────────────
export const exportUrls = {
  sprint:  (sid: string) => `${BASE_URL}/export/${sid}/sprint`,
  roadmap: (sid: string) => `${BASE_URL}/export/${sid}/roadmap`,
};
