const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-production-c6ed5.up.railway.app";
const SITE_ID = process.env.NEXT_PUBLIC_SITE_ID || "d3920d22-2c34-40b1-9e8e-59142af08e2a";

export { SITE_ID, API_URL };

export interface Article {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  keyword: string;
  body_md: string;
  body_html?: string;
  category?: string;
  status: string;
  created_at: string;
  updated_at: string;
  faq_section?: Array<{ question: string; answer: string }>;
  site_id?: string;
}

export async function getArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${API_URL}/api/content?site_id=${SITE_ID}&status=approved`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.items ?? [];
  } catch {
    return [];
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API_URL}/api/content/by-slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface LeadData {
  email: string;
  nombre?: string;
  site_id?: string;
  asset_id?: string;
  cta_variant?: string;
  origen_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  metadata?: Record<string, unknown>;
}

export async function captureLead(data: LeadData): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/leads/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, site_id: SITE_ID }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function trackVisitor(fingerprint: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/tracking/visitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint, site_id: SITE_ID }),
    });
  } catch {
    // silent
  }
}

export async function trackSession(data: {
  visitor_fingerprint: string;
  page_url: string;
  referrer?: string;
}): Promise<void> {
  try {
    await fetch(`${API_URL}/api/tracking/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, site_id: SITE_ID }),
    });
  } catch {
    // silent
  }
}

export async function trackEvent(data: {
  visitor_fingerprint: string;
  event_type: string;
  page_url?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch(`${API_URL}/api/tracking/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, site_id: SITE_ID }),
    });
  } catch {
    // silent
  }
}
