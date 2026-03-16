// NEXT_PUBLIC_ prefix required for client components (calculator, email form)
// Falls back to API_URL for server-only usage during local dev
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";

async function fetchAPI<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export interface Budget {
  spent: number;
  limit: number;
  remaining: number;
  percent: number;
  blocked: boolean;
  warning: boolean;
}

export interface ContentAsset {
  id: string;
  title: string;
  slug: string;
  keyword: string;
  status: "generating" | "draft" | "review" | "approved" | "error";
  quality_score: number | null;
  humanization_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  intent_score: number;
  tema_interes: string | null;
  utm_source: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  action_url: string | null;
  action_label: string | null;
  created_at: string;
}

export interface Status {
  budget: Budget;
  content: Record<string, number>;
  leads_today: number;
  features: Record<string, boolean>;
}

export interface ArticleFull extends ContentAsset {
  body_html: string;
  body_md: string;
  meta_description: string;
  faq_section: Array<{ question: string; answer: string }>;
  brief: Record<string, unknown>;
  outline: Record<string, unknown>;
  mission_id: string;
  updated_at: string;
}

export const api = {
  status: () => fetchAPI<Status>("/api/status"),
  budget: () => fetchAPI<Budget>("/api/budget"),
  content: (status?: string) =>
    fetchAPI<ContentAsset[]>(`/api/content${status ? `?status=${status}` : ""}`),
  contentItem: (id: string) => fetchAPI<ArticleFull>(`/api/content/${id}`),
  contentBySlug: (slug: string) => fetchAPI<ArticleFull>(`/api/content/by-slug/${slug}`),
  sitemap: () => fetchAPI<Array<{ slug: string; updated_at: string }>>("/api/sitemap"),
  leads: () => fetchAPI<Lead[]>("/api/leads"),
  alerts: () => fetchAPI<Alert[]>("/api/alerts"),
};

export async function captureLead(data: {
  email: string;
  nombre?: string;
  origen_url?: string;
  tema_interes?: string;
  intent_score?: number;
  calculator_data?: Record<string, unknown>;
}): Promise<{ status: string; id: string | null }> {
  const res = await fetch(`${API_URL}/api/leads/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Lead capture failed: ${res.status}`);
  return res.json();
}
