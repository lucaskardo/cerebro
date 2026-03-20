// NEXT_PUBLIC_ prefix required for client components (calculator, email form)
// Falls back to API_URL for server-only usage during local dev
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

async function fetchAPI<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  const res = await fetch(`${API_URL}${path}`, { headers, cache: "no-store" });
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
  score_humanity: number | null;
  score_specificity: number | null;
  score_structure: number | null;
  score_seo: number | null;
  score_readability: number | null;
  score_feedback: string | null;
  site_id: string | null;
  body_html?: string | null;
  meta_description?: string | null;
  faq_section?: Array<{ question: string; answer: string }> | null;
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
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  cta_variant: string | null;
  asset_id: string | null;
  origen_url: string | null;
  quiz_responses: Record<string, string> | null;
  current_status: string | null;
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

export interface Site {
  id: string;
  domain: string;
  brand_name: string | null;
  brand_persona: string | null;
  brand_tone: string | null;
  brand_audience: Record<string, unknown> | null;
  brand_topics: string[] | null;
  brand_cta: Record<string, unknown> | null;
  author_name: string | null;
  author_bio: string | null;
  status: string;
  site_type: string;
  mission_id?: string;
}

export interface ContentRecommendation {
  keyword: string;
  reason: string;
  priority: number;
  source: "insight" | "entity" | "fact";
}

export interface Goal {
  id: string;
  site_id: string | null;
  description: string;
  target_metric: string;
  target_value: number;
  current_value: number;
  status: "active" | "achieved" | "paused";
  created_at: string;
}

export interface Strategy {
  id: string;
  goal_id: string;
  site_id: string | null;
  name: string;
  description: string;
  channel: string;
  skills_needed: string[];
  estimated_leads: number;
  estimated_cost: number;
  confidence_score: number;
  status: "proposed" | "approved" | "running" | "completed" | "failed";
  results: Record<string, unknown>;
  created_at: string;
}

export interface Funnel {
  period_days: number;
  pageviews: number;
  clicks: number;
  form_starts: number;
  leads_captured: number;
  conversions: number;
  conversion_rate: number;
  // new spine fields
  visitors?: number;
  sessions?: number;
  leads?: number;
  qualified?: number;
  accepted?: number;
  lead_rate?: number;
  qualify_rate?: number;
}

export interface LeadsByAsset {
  asset_id: string;
  total: number;
  qualified: number;
}

export interface LeadsByBrand {
  site_id: string;
  total: number;
  qualified: number;
}

export interface LeadsByCta {
  cta_variant: string;
  total: number;
  qualified: number;
}

export interface RevenueByAsset {
  asset_id: string;
  revenue: number;
}

export interface ClientProfile {
  id: string;
  site_id: string;
  company_name: string;
  company_url: string | null;
  country: string;
  industry: string | null;
  value_proposition: string | null;
  core_competencies: string[];
  pain_points: string[];
  desires: string[];
  target_segments: Array<{ name: string; description: string; size: string; priority: string }>;
  advantages: string[];
  weaknesses: string[];
  competitors: Array<{ name: string; url?: string; positioning: string; weakness: string }>;
  content_angles: string[];
  customer_objections: string[];
  buying_triggers: string[];
  market_trends: string[];
  key_differentiators: string[];
  brand_voice_notes: string | null;
  research_depth: "none" | "initial" | "standard" | "deep";
  research_version: number;
  last_researched_at: string | null;
  research_entry_count?: number;
}

export interface MarketResearch {
  id: string;
  site_id: string;
  research_type: string;
  query: string;
  findings: string | null;
  confidence: "low" | "medium" | "high";
  source: string;
  created_at: string;
}

export interface AttributionChain {
  asset_id: string;
  asset_title: string;
  asset_keyword: string;
  leads_generated: number;
  leads_qualified: number;
  leads_accepted: number;
  revenue: number;
  top_cta_variant: string | null;
  top_utm_source: string | null;
}

export interface BusinessHealth {
  leads_today: number;
  leads_this_week: number;
  articles_published_week: number;
  error_rate_24h: number;
  cost_today: number;
  top_performing_asset_title: string | null;
  budget_remaining: number;
  budget_warning: boolean;
}

export interface Persona {
  id: string;
  site_id: string;
  name: string;
  age: number | null;
  city: string | null;
  backstory: string | null;
  personality_traits: Record<string, string>;
  visual_prompt: string | null;
  platforms: Record<string, unknown>;
  posting_schedule: Record<string, unknown>;
  content_ratio: Record<string, unknown>;
  anti_detection_rules: Record<string, unknown>;
  status: "active" | "inactive" | "suspended";
  created_at: string;
}

export interface PersonaIdentity {
  id: string;
  persona_id: string;
  platform: string;
  handle_or_email: string | null;
  password_encrypted: string | null;   // always "••••••••" unless revealed
  password_plaintext?: string;          // only present after reveal
  recovery_email: string | null;
  recovery_phone: string | null;
  api_keys: Record<string, string>;
  two_factor_secret: string | null;
  notes: string | null;
  status: "active" | "suspended" | "pending_setup";
  last_used_at: string | null;
  created_at: string;
}

export interface SocialQueueItem {
  id: string;
  content_asset_id: string | null;
  persona_id: string;
  platform: string;
  content_type: string;
  content_text: string;
  image_prompt: string | null;
  audio_url: string | null;
  video_url: string | null;
  status: "draft" | "scheduled" | "published" | "failed" | "rejected";
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  // joined
  personas?: { name: string };
  content_assets?: { title: string; slug: string };
}

export interface Opportunity {
  id: string;
  site_id: string | null;
  goal_id: string | null;
  query: string | null;
  pain_point: string | null;
  audience: string | null;
  channel: string;
  intent: string;
  expected_value: number;
  confidence: "low" | "medium" | "high";
  execution_status: "detected" | "evaluated" | "planned" | "executing" | "measured";
  status: string;
  created_at: string;
}

export interface Experiment {
  id: string;
  site_id: string | null;
  opportunity_id: string | null;
  hypothesis: string;
  target_metric: string | null;
  variant_a_json: Record<string, unknown>;
  variant_b_json: Record<string, unknown>;
  run_window_days: number;
  status: "planned" | "running" | "evaluated" | "winner_declared" | "archived";
  outcome_json: Record<string, unknown>;
  winner: string | null;
  learnings: string | null;
  visits_a: number;
  visits_b: number;
  metric_baseline: number | null;
  metric_variant: number | null;
  created_at: string;
  evaluated_at: string | null;
}

export interface Task {
  id: string;
  experiment_id: string | null;
  site_id: string | null;
  skill_name: string;
  input_json: Record<string, unknown>;
  depends_on: string | null;
  status: "pending" | "running" | "completed" | "failed" | "retrying" | "dead_lettered";
  output_json: Record<string, unknown>;
  error: string | null;
  attempts: number;
  estimated_cost: number;
  actual_cost: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Approval {
  id: string;
  site_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  requested_by: string;
  approved_by: string | null;
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface IntelEntity {
  id: string; site_id: string; entity_type: string; name: string;
  slug: string; description: string | null; status: string;
  metadata: Record<string, any>; created_at: string; updated_at: string;
}
export interface IntelFact {
  id: string; site_id: string; entity_id: string | null; fact_key: string;
  category: string; value_text: string | null; value_number: number | null;
  value_json: any; confidence: number; utility_score: number;
  evidence_count: number; quarantined: boolean; tags: string[];
  source: string | null; last_verified: string | null;
}
export interface IntelInsight {
  id: string; site_id: string; insight_type: string; title: string;
  body: string; supporting_facts: string[]; impact_score: number; status: string;
}
export interface IntelDiscovery {
  id: string; site_id: string; candidate_type: string; proposed_slug: string;
  proposed_data: Record<string, any>; metrics: Record<string, any>;
  status: string; decision_reason: string | null; decided_at: string | null;
  created_at: string | null;
}
export interface CompletenessRow {
  entity_id: string; name: string; entity_type: string;
  fact_count: number; categories: string[];
}
export interface ResearchRun {
  id: string; site_id: string; task_type: string; trigger: string;
  status: string; tokens_used: number; search_calls: number;
  cost_usd: number; error_message: string | null;
  started_at: string | null; completed_at: string | null;
}

export const intelV2 = {
  entities: (siteId: string, type?: string) =>
    fetchAPI<IntelEntity[]>(`/api/v2/intelligence/entities/${siteId}${type ? `?type=${type}` : ""}`),
  facts: (siteId: string, opts?: { category?: string; entity_id?: string }) => {
    const q = new URLSearchParams();
    if (opts?.category) q.set("category", opts.category);
    if (opts?.entity_id) q.set("entity_id", opts.entity_id);
    return fetchAPI<IntelFact[]>(`/api/v2/intelligence/facts/${siteId}${q.toString() ? `?${q}` : ""}`);
  },
  insights: (siteId: string) =>
    fetchAPI<IntelInsight[]>(`/api/v2/intelligence/insights/${siteId}`),
  discoveries: (siteId: string, status = "proposed") =>
    fetchAPI<IntelDiscovery[]>(`/api/v2/intelligence/discoveries/${siteId}?status=${status}`),
  decideDiscovery: (id: string, status: "approved" | "rejected", reason?: string) =>
    fetch(`${API_URL}/api/v2/intelligence/discoveries/${id}/decide`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ status, reason }),
    }).then(r => r.json()),
  completeness: (siteId: string) =>
    fetchAPI<CompletenessRow[]>(`/api/v2/intelligence/completeness/${siteId}`),
  research: (siteId: string) =>
    fetchAPI<ResearchRun[]>(`/api/v2/intelligence/research/${siteId}`),
  triggerAnalysis: (siteId: string) =>
    fetch(`${API_URL}/api/v2/intelligence/analyze/${siteId}`, {
      method: "POST", headers: authHeaders(),
    }).then(r => r.json()),
  triggerResearch: (siteId: string) =>
    fetch(`${API_URL}/api/v2/intelligence/research/${siteId}`, {
      method: "POST", headers: authHeaders(),
    }).then(r => r.json()),
};

export const api = {
  status: () => fetchAPI<Status>("/api/status"),
  budget: () => fetchAPI<Budget>("/api/budget"),
  content: (status?: string, siteId?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (siteId) q.set("site_id", siteId);
    return fetchAPI<ContentAsset[]>(`/api/content${q.toString() ? `?${q}` : ""}`);
  },
  contentItem: (id: string) => fetchAPI<ArticleFull>(`/api/content/${id}`),
  contentBySlug: (slug: string) => fetchAPI<ArticleFull>(`/api/content/by-slug/${slug}`),
  sitemap: () => fetchAPI<Array<{ slug: string; updated_at: string }>>("/api/sitemap"),
  leads: (siteId?: string) =>
    fetchAPI<Lead[]>(`/api/leads${siteId ? `?site_id=${siteId}` : ""}`),
  leadDetail: (id: string) => fetchAPI<Lead>(`/api/leads/${id}`),
  alerts: () => fetchAPI<Alert[]>("/api/alerts"),
  goals: (siteId?: string) =>
    fetchAPI<Goal[]>(`/api/goals${siteId ? `?site_id=${siteId}` : ""}`),
  strategies: (goalId?: string, siteId?: string) => {
    const q = new URLSearchParams();
    if (goalId) q.set("goal_id", goalId);
    if (siteId) q.set("site_id", siteId);
    return fetchAPI<Strategy[]>(`/api/strategies${q.toString() ? `?${q}` : ""}`);
  },
  funnel: (days = 30) => fetchAPI<Funnel>(`/api/attribution/funnel?days=${days}`),
  funnelNew: (days = 30, siteId?: string) =>
    fetchAPI<Funnel>(`/api/reports/funnel?days=${days}${siteId ? `&site_id=${siteId}` : ""}`),
  leadsByAsset: (days = 30, siteId?: string) =>
    fetchAPI<LeadsByAsset[]>(`/api/reports/leads-by-asset?days=${days}${siteId ? `&site_id=${siteId}` : ""}`),
  leadsByBrand: (days = 30) =>
    fetchAPI<LeadsByBrand[]>(`/api/reports/leads-by-brand?days=${days}`),
  leadsByCta: (days = 30, siteId?: string) =>
    fetchAPI<LeadsByCta[]>(`/api/reports/leads-by-cta?days=${days}${siteId ? `&site_id=${siteId}` : ""}`),
  revenueByAsset: (siteId?: string) =>
    fetchAPI<RevenueByAsset[]>(`/api/reports/revenue-by-asset${siteId ? `?site_id=${siteId}` : ""}`),
  attributionChain: (days = 30, siteId?: string) =>
    fetchAPI<AttributionChain[]>(`/api/reports/attribution-chain?days=${days}${siteId ? `&site_id=${siteId}` : ""}`),
  businessHealth: () => fetchAPI<BusinessHealth>("/api/health/business"),
  sites: () => fetchAPI<Site[]>("/api/sites"),
  relatedContent: (limit = 5) => fetchAPI<ContentAsset[]>(`/api/content?status=approved&limit=${limit}`),
  contentBySite: (siteId: string, limit = 20) =>
    fetchAPI<ContentAsset[]>(`/api/content?status=approved&site_id=${siteId}&limit=${limit}`),
  personas: (siteId?: string) =>
    fetchAPI<Persona[]>(`/api/personas${siteId ? `?site_id=${siteId}` : ""}`),
  personaIdentities: (personaId: string) =>
    fetchAPI<PersonaIdentity[]>(`/api/personas/${personaId}/identities`),
  personaIdentitiesRevealed: (personaId: string, masterKey: string) =>
    fetch(`${API_URL}/api/personas/${personaId}/identities?reveal=true`, {
      headers: { ...authHeaders(), "x-master-key": masterKey },
      cache: "no-store",
    }).then((r) => {
      if (!r.ok) throw new Error(`Reveal failed: ${r.status}`);
      return r.json() as Promise<PersonaIdentity[]>;
    }),
  opportunities: (params?: { goal_id?: string; site_id?: string; execution_status?: string }) => {
    const q = new URLSearchParams();
    if (params?.goal_id) q.set("goal_id", params.goal_id);
    if (params?.site_id) q.set("site_id", params.site_id);
    if (params?.execution_status) q.set("execution_status", params.execution_status);
    return fetchAPI<Opportunity[]>(`/api/opportunities${q.toString() ? `?${q}` : ""}`);
  },
  experiments: (params?: { site_id?: string; status?: string; opportunity_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.site_id) q.set("site_id", params.site_id);
    if (params?.status) q.set("status", params.status);
    if (params?.opportunity_id) q.set("opportunity_id", params.opportunity_id);
    return fetchAPI<Experiment[]>(`/api/experiments${q.toString() ? `?${q}` : ""}`);
  },
  tasks: (params?: { site_id?: string; experiment_id?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.site_id) q.set("site_id", params.site_id);
    if (params?.experiment_id) q.set("experiment_id", params.experiment_id);
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    return fetchAPI<Task[]>(`/api/tasks${q.toString() ? `?${q}` : ""}`);
  },
  approvals: (status = "pending", site_id?: string) => {
    const q = new URLSearchParams({ status });
    if (site_id) q.set("site_id", site_id);
    return fetchAPI<Approval[]>(`/api/approvals?${q}`);
  },
  cycleHistory: (limit = 10) =>
    fetchAPI<Record<string, unknown>[]>(`/api/loop/history?limit=${limit}`),
  loopStatus: () => fetchAPI<Record<string, unknown>>("/api/loop/status"),
  knowledgeInsights: (limit = 12) =>
    fetchAPI<Record<string, unknown>[]>(`/api/knowledge/insights?limit=${limit}`),
  intelligenceProfile: (siteId: string) =>
    fetchAPI<ClientProfile>(`/api/intelligence/profile/${siteId}`),
  intelligenceResearchLog: (siteId: string, limit = 20) =>
    fetchAPI<MarketResearch[]>(`/api/intelligence/research-log/${siteId}?limit=${limit}`),
  socialQueue: (params?: { persona_id?: string; platform?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.persona_id) q.set("persona_id", params.persona_id);
    if (params?.platform) q.set("platform", params.platform);
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    return fetchAPI<SocialQueueItem[]>(`/api/social/queue${q.toString() ? `?${q}` : ""}`);
  },
  recommendations: (siteId: string) => getContentRecommendations(siteId),
};

export async function getContentRecommendations(siteId: string): Promise<ContentRecommendation[]> {
  const res = await fetch(`${API_URL}/api/content/recommend/${siteId}`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function generateContent(data: {
  keyword: string;
  site_id: string;
  mission_id: string;
}): Promise<{ asset_id: string; status: string; keyword: string }> {
  const res = await fetch(`${API_URL}/api/content/generate`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.json();
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  return { ...h, ...extra };
}

export async function reviewContent(id: string, action: "approve" | "reject", notes?: string): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/content/${id}/review`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action, notes }),
  });
  if (!res.ok) throw new Error(`Review failed: ${res.status}`);
  return res.json();
}

export async function approveStrategy(id: string): Promise<Strategy> {
  const res = await fetch(`${API_URL}/api/strategies/${id}/approve`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
  return res.json();
}

export async function generateStrategies(goalId: string): Promise<Strategy[]> {
  const res = await fetch(`${API_URL}/api/strategies/generate?goal_id=${goalId}`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.json();
}

export async function createGoal(data: { description: string; target_metric: string; target_value: number }): Promise<Goal> {
  const res = await fetch(`${API_URL}/api/goals`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create goal failed: ${res.status}`);
  return res.json();
}

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

export async function updatePersona(id: string, data: Partial<Persona>): Promise<Persona> {
  const res = await fetch(`${API_URL}/api/personas/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update persona failed: ${res.status}`);
  return res.json();
}

export async function createIdentity(
  personaId: string,
  data: {
    platform: string;
    handle_or_email?: string;
    password?: string;
    recovery_email?: string;
    notes?: string;
    status?: string;
  }
): Promise<PersonaIdentity> {
  const res = await fetch(`${API_URL}/api/personas/${personaId}/identities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create identity failed: ${res.status}`);
  return res.json();
}

export async function updateIdentity(
  id: string,
  data: Partial<PersonaIdentity & { password?: string }>
): Promise<PersonaIdentity> {
  const res = await fetch(`${API_URL}/api/personas/identities/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update identity failed: ${res.status}`);
  return res.json();
}

export async function updateQueueItem(
  id: string,
  data: { status?: string; scheduled_at?: string; notes?: string }
): Promise<SocialQueueItem> {
  const res = await fetch(`${API_URL}/api/social/queue/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update queue item failed: ${res.status}`);
  return res.json();
}

export async function runIntelligenceResearch(data: {
  site_id: string;
  company: string;
  country: string;
  company_url?: string;
  industry?: string;
}): Promise<ClientProfile> {
  const res = await fetch(`${API_URL}/api/intelligence/research`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Research failed: ${res.status}`);
  return res.json();
}

export async function refreshIntelligence(siteId: string): Promise<ClientProfile> {
  const res = await fetch(`${API_URL}/api/intelligence/refresh/${siteId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  return res.json();
}

export async function patchIntelligenceProfile(
  siteId: string,
  data: Partial<ClientProfile>
): Promise<ClientProfile> {
  const res = await fetch(`${API_URL}/api/intelligence/profile/${siteId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Patch failed: ${res.status}`);
  return res.json();
}
