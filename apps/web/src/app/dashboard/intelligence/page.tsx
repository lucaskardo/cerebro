"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, runIntelligenceResearch, refreshIntelligence } from "@/lib/api";
import type { ClientProfile, MarketResearch, Site } from "@/lib/api";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DEPTH_BADGE: Record<string, string> = {
  none: "badge badge-gray",
  initial: "badge badge-yellow",
  standard: "badge badge-blue",
  deep: "badge badge-green",
};

const CONF_BADGE: Record<string, string> = {
  low: "badge badge-yellow",
  medium: "badge badge-blue",
  high: "badge badge-green",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem" }}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  if (!items?.length) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>—</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.375rem" }}>
      {items.map((item, i) => (
        <span key={i} style={{
          padding: "0.25rem 0.625rem",
          borderRadius: "0.375rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--dash-border)",
          fontSize: "0.75rem",
          color: "var(--dash-text)",
        }}>{item}</span>
      ))}
    </div>
  );
}

// ─── Research Form ─────────────────────────────────────────────────────────────

function ResearchForm({ sites, onSuccess }: { sites: Site[]; onSuccess: () => void }) {
  const [form, setForm] = useState({
    site_id: sites[0]?.id || "",
    company: "",
    country: "",
    company_url: "",
    industry: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site_id || !form.company || !form.country) {
      setError("site_id, company, and country are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await runIntelligenceResearch({
        site_id: form.site_id,
        company: form.company,
        country: form.country,
        company_url: form.company_url || undefined,
        industry: form.industry || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", color: "var(--dash-text)" }}>
        Run Deep Market Research
      </h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Site</label>
            <select
              value={form.site_id}
              onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.brand_name || s.domain}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Company Name *</label>
            <input
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="e.g. ikigii"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Country *</label>
            <input
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              placeholder="e.g. Colombia"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Industry</label>
            <input
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              placeholder="e.g. fintech wealth management"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Website URL</label>
            <input
              value={form.company_url}
              onChange={e => setForm(f => ({ ...f, company_url: e.target.value }))}
              placeholder="https://example.com"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
        </div>
        {error && <p style={{ color: "var(--dash-danger)", fontSize: "0.75rem" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "0.625rem 1.25rem", background: "var(--dash-accent)", color: "#000", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.8125rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, alignSelf: "flex-start" as const }}
        >
          {loading ? "Researching… (30-60s)" : "Run Research"}
        </button>
      </form>
    </div>
  );
}

// ─── Profile View ──────────────────────────────────────────────────────────────

function ProfileView({ profile, onRefresh, refreshing }: {
  profile: ClientProfile;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: "1.5rem" }}>
      {/* Profile header card */}
      <div className="dash-card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" as const }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--dash-text)" }}>
                {profile.company_name}
              </h2>
              <span className={DEPTH_BADGE[profile.research_depth]}>
                {profile.research_depth}
              </span>
              <span className="badge badge-gray">v{profile.research_version}</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>
              {profile.country}{profile.industry ? ` · ${profile.industry}` : ""}
              {profile.company_url && (
                <> · <a href={profile.company_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--dash-accent)" }}>{profile.company_url}</a></>
              )}
            </p>
            {profile.value_proposition && (
              <p style={{ fontSize: "0.875rem", color: "var(--dash-text)", marginTop: "0.75rem", lineHeight: 1.5, maxWidth: "60ch" }}>
                {profile.value_proposition}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: "0.5rem" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
              Last researched: {fmtDate(profile.last_researched_at)}
            </p>
            {profile.research_entry_count !== undefined && (
              <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                {profile.research_entry_count} research entries
              </p>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              style={{ padding: "0.5rem 1rem", background: "rgba(255,255,255,0.06)", border: "1px solid var(--dash-border)", borderRadius: "0.5rem", color: "var(--dash-text)", fontSize: "0.75rem", cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1 }}
            >
              {refreshing ? "Refreshing…" : "Refresh Research"}
            </button>
          </div>
        </div>
      </div>

      {/* Pain points + Desires */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Audience Pain Points">
          <div className="dash-card" style={{ padding: "1rem" }}>
            {profile.pain_points?.length ? (
              <ul style={{ margin: 0, padding: "0 0 0 1.125rem", display: "flex", flexDirection: "column" as const, gap: "0.375rem" }}>
                {profile.pain_points.map((p, i) => (
                  <li key={i} style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.5 }}>{p}</li>
                ))}
              </ul>
            ) : <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>—</p>}
          </div>
        </Section>
        <Section title="Audience Desires">
          <div className="dash-card" style={{ padding: "1rem" }}>
            {profile.desires?.length ? (
              <ul style={{ margin: 0, padding: "0 0 0 1.125rem", display: "flex", flexDirection: "column" as const, gap: "0.375rem" }}>
                {profile.desires.map((d, i) => (
                  <li key={i} style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.5 }}>{d}</li>
                ))}
              </ul>
            ) : <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>—</p>}
          </div>
        </Section>
      </div>

      {/* Competitors table */}
      <Section title="Competitor Landscape">
        <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
          {profile.competitors?.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Competitor</th>
                    <th>Positioning</th>
                    <th>Weakness (our opportunity)</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.competitors.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--dash-text)" }}>
                          {typeof c === "object" ? c.name : String(c)}
                        </span>
                        {typeof c === "object" && c.url && (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "0.6875rem", color: "var(--dash-accent)" }}>{c.url}</a>
                        )}
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", maxWidth: 220 }}>
                        {typeof c === "object" ? c.positioning : "—"}
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "#f59e0b", maxWidth: 220 }}>
                        {typeof c === "object" ? c.weakness : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "1.5rem", textAlign: "center" as const, color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>No competitors identified</div>
          )}
        </div>
      </Section>

      {/* Content angles + Market trends */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Content Angles">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.content_angles || []} />
          </div>
        </Section>
        <Section title="Market Trends">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.market_trends || []} />
          </div>
        </Section>
      </div>

      {/* Buying triggers + Objections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Buying Triggers">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.buying_triggers || []} />
          </div>
        </Section>
        <Section title="Customer Objections">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.customer_objections || []} />
          </div>
        </Section>
      </div>

      {/* Key differentiators + Voice */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Key Differentiators">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.key_differentiators || []} />
          </div>
        </Section>
        <Section title="Brand Voice Notes">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.6 }}>
              {profile.brand_voice_notes || "—"}
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Research Log ──────────────────────────────────────────────────────────────

function ResearchLog({ entries }: { entries: MarketResearch[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!entries.length) return null;
  const shown = expanded ? entries : entries.slice(0, 3);
  return (
    <Section title={`Research Log (${entries.length})`}>
      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Query</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(r.created_at)}</span></td>
                  <td><span className="badge badge-gray" style={{ fontSize: "0.6875rem" }}>{r.research_type}</span></td>
                  <td style={{ fontSize: "0.8125rem", color: "var(--dash-text)", maxWidth: 300 }}>{r.query}</td>
                  <td><span className={CONF_BADGE[r.confidence]}>{r.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entries.length > 3 && (
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--dash-border)" }}>
            <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "var(--dash-accent)", fontSize: "0.8125rem", cursor: "pointer" }}>
              {expanded ? "Show less" : `Show all ${entries.length}`}
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function IntelligenceContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";

  const [sites, setSites] = useState<Site[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [log, setLog] = useState<MarketResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState(siteId);

  const load = async (sid: string) => {
    setLoading(true);
    const [sitesRes, profileRes, logRes] = await Promise.allSettled([
      api.sites(),
      sid ? api.intelligenceProfile(sid).catch(() => null) : Promise.resolve(null),
      sid ? api.intelligenceResearchLog(sid).catch(() => [] as MarketResearch[]) : Promise.resolve([] as MarketResearch[]),
    ]);
    if (sitesRes.status === "fulfilled") {
      setSites(sitesRes.value);
      if (!sid && sitesRes.value[0]) {
        setActiveSiteId(sitesRes.value[0].id);
      }
    }
    if (profileRes.status === "fulfilled") setProfile(profileRes.value as ClientProfile | null);
    if (logRes.status === "fulfilled") setLog(Array.isArray(logRes.value) ? logRes.value as MarketResearch[] : []);
    setLoading(false);
  };

  useEffect(() => { load(activeSiteId); }, [activeSiteId]);

  const handleRefresh = async () => {
    if (!activeSiteId) return;
    setRefreshing(true);
    try {
      const updated = await refreshIntelligence(activeSiteId);
      setProfile(updated);
      const newLog = await api.intelligenceResearchLog(activeSiteId);
      setLog(Array.isArray(newLog) ? newLog : []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleResearchSuccess = () => {
    setShowForm(false);
    load(activeSiteId);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" as const }}>
        <div>
          <h1 className="page-title">Client Intelligence</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
            Deep market research that informs every piece of content and strategy
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {sites.length > 1 && (
            <select
              value={activeSiteId}
              onChange={e => setActiveSiteId(e.target.value)}
              style={{ padding: "0.5rem 0.75rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.brand_name || s.domain}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ padding: "0.625rem 1.25rem", background: "var(--dash-accent)", color: "#000", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer" }}
          >
            {showForm ? "Cancel" : "+ Run Research"}
          </button>
        </div>
      </div>

      {showForm && sites.length > 0 && (
        <ResearchForm sites={sites} onSuccess={handleResearchSuccess} />
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
          {[...Array(3)].map((_, i) => <div key={i} className="dash-card skeleton" style={{ height: "8rem" }} />)}
        </div>
      ) : profile ? (
        <>
          <ProfileView profile={profile} onRefresh={handleRefresh} refreshing={refreshing} />
          <ResearchLog entries={log} />
        </>
      ) : (
        <div className="dash-card" style={{ textAlign: "center" as const, padding: "4rem 1.5rem", color: "var(--dash-text-dim)" }}>
          <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>No client profile yet</p>
          <p style={{ fontSize: "0.75rem", color: "var(--dash-muted)" }}>Click &ldquo;Run Research&rdquo; to generate deep market intelligence for this client</p>
        </div>
      )}
    </div>
  );
}

export default function IntelligenceDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <IntelligenceContent />
    </Suspense>
  );
}
