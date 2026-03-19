"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { intelV2 } from "@/lib/api";
import type { IntelEntity, IntelFact, IntelInsight, IntelDiscovery, CompletenessRow, ResearchRun } from "@/lib/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function fmtUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

const ENTITY_BORDER: Record<string, string> = {
  brand: "#3b82f6",
  store: "#22c55e",
  product: "#a855f7",
  segment: "#14b8a6",
  pain_point: "#f97316",
  objection: "#ef4444",
};

const ENTITY_LABEL: Record<string, string> = {
  brand: "Brands 🏷️",
  store: "Stores 🏪",
  product: "Products 📦",
  segment: "Segments 👥",
  pain_point: "Pain Points 💢",
  objection: "Objections 🚫",
};

const INSIGHT_BORDER: Record<string, string> = {
  opportunity: "#22c55e",
  threat: "#ef4444",
  gap: "#eab308",
  trend: "#3b82f6",
  positioning: "#a855f7",
  recommendation: "#14b8a6",
  anomaly: "#f97316",
};

const STATUS_BADGE: Record<string, string> = {
  running: "badge badge-blue",
  completed: "badge badge-green",
  failed: "badge badge-red",
  proposed: "badge badge-yellow",
  approved: "badge badge-green",
  rejected: "badge badge-gray",
};

const CONF_COLOR = (c: number) =>
  c >= 0.8 ? "#22c55e" : c >= 0.5 ? "#eab308" : "#ef4444";

function Bar({ value, max = 1, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", width: "100%", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color || "var(--dash-accent)", borderRadius: "3px", transition: "width 0.3s" }} />
    </div>
  );
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 200,
      background: "var(--dash-surface)", border: "1px solid var(--dash-border-hi)",
      borderRadius: "8px", padding: "0.75rem 1.25rem",
      color: "var(--dash-accent)", fontSize: "0.8125rem",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      {msg}
    </div>
  );
}

// ─── Tab: Landscape ─────────────────────────────────────────────────────────

function LandscapeTab({ siteId }: { siteId: string }) {
  const [entities, setEntities] = useState<IntelEntity[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entityFacts, setEntityFacts] = useState<Record<string, IntelFact[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    Promise.all([intelV2.entities(siteId), intelV2.completeness(siteId)])
      .then(([e, c]) => { setEntities(e); setCompleteness(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  const completenessMap = Object.fromEntries(completeness.map(c => [c.entity_id, c]));

  const toggleEntity = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!entityFacts[id]) {
      try {
        const facts = await intelV2.facts(siteId, { entity_id: id });
        setEntityFacts(prev => ({ ...prev, [id]: facts }));
      } catch {}
    }
  };

  const grouped = entities.reduce<Record<string, IntelEntity[]>>((acc, e) => {
    (acc[e.entity_type] = acc[e.entity_type] || []).push(e);
    return acc;
  }, {});

  const DISPLAY_ORDER = ["brand", "store", "product", "segment", "pain_point", "objection"];
  const allTypes = [...DISPLAY_ORDER.filter(t => grouped[t]), ...Object.keys(grouped).filter(t => !DISPLAY_ORDER.includes(t))];

  if (loading) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Loading landscape…</p>;
  if (!entities.length) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>No entities found for this site.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {allTypes.map(type => (
        <div key={type}>
          <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
            {ENTITY_LABEL[type] || type}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
            {grouped[type].map(entity => {
              const cRow = completenessMap[entity.id];
              const isOpen = expandedId === entity.id;
              return (
                <div key={entity.id}>
                  <div
                    className="dash-card"
                    onClick={() => toggleEntity(entity.id)}
                    style={{
                      borderLeft: `3px solid ${ENTITY_BORDER[type] || "#666"}`,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{entity.name}</div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                        {cRow && <span className="badge badge-blue">{cRow.fact_count} facts</span>}
                        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {entity.description && (
                      <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "0.375rem", lineHeight: 1.5 }}>
                        {entity.description.slice(0, 100)}{entity.description.length > 100 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  {isOpen && (
                    <div style={{ border: "1px solid var(--dash-border)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "0.75rem", background: "rgba(255,255,255,0.02)" }}>
                      {!entityFacts[entity.id] ? (
                        <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>Loading facts…</p>
                      ) : entityFacts[entity.id].length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>No facts yet.</p>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                          <thead>
                            <tr style={{ color: "var(--dash-text-dim)", textAlign: "left" }}>
                              <th style={{ padding: "0.25rem 0.375rem" }}>Key</th>
                              <th style={{ padding: "0.25rem 0.375rem" }}>Value</th>
                              <th style={{ padding: "0.25rem 0.375rem", width: "80px" }}>Conf</th>
                              <th style={{ padding: "0.25rem 0.375rem", width: "80px" }}>Utility</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entityFacts[entity.id].map(f => (
                              <tr key={f.id} style={{ borderTop: "1px solid var(--dash-border)" }}>
                                <td style={{ padding: "0.375rem", fontFamily: "'JetBrains Mono', monospace", color: "var(--dash-text-dim)" }}>{f.fact_key}</td>
                                <td style={{ padding: "0.375rem" }}>
                                  {f.value_text ?? (f.value_number !== null ? String(f.value_number) : "JSON")}
                                </td>
                                <td style={{ padding: "0.375rem" }}>
                                  <Bar value={f.confidence} color={CONF_COLOR(f.confidence)} />
                                  <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{Math.round(f.confidence * 100)}%</span>
                                </td>
                                <td style={{ padding: "0.375rem" }}>
                                  <Bar value={f.utility_score} color="#a855f7" />
                                  <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{Math.round(f.utility_score * 100)}%</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Facts ──────────────────────────────────────────────────────────────

function FactsTab({ siteId }: { siteId: string }) {
  const [facts, setFacts] = useState<IntelFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    intelV2.facts(siteId)
      .then(setFacts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  const categories = Array.from(new Set(facts.map(f => f.category))).sort();
  const filtered = categoryFilter ? facts.filter(f => f.category === categoryFilter) : facts;

  if (loading) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Loading facts…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{
            background: "var(--dash-surface)", border: "1px solid var(--dash-border)",
            borderRadius: "6px", color: "var(--dash-text)", padding: "0.375rem 0.625rem",
            fontSize: "0.8125rem", fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{filtered.length} facts</span>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="dash-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Fact Key</th>
              <th>Category</th>
              <th>Value</th>
              <th>Confidence</th>
              <th>Utility</th>
              <th>Evidence</th>
              <th>Last Verified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--dash-text-dim)", padding: "1.5rem" }}>No facts found</td></tr>
            ) : filtered.map(f => (
              <tr key={f.id} style={f.quarantined ? { textDecoration: "line-through", opacity: 0.5, color: "#ef4444" } : {}}>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>{f.fact_key}</td>
                <td><span className={`badge badge-blue`}>{f.category}</span></td>
                <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.value_text ?? (f.value_number !== null ? String(f.value_number) : "JSON")}
                </td>
                <td>
                  <span style={{ color: CONF_COLOR(f.confidence), fontWeight: 600, fontSize: "0.8125rem" }}>
                    {Math.round(f.confidence * 100)}%
                  </span>
                </td>
                <td style={{ fontSize: "0.8125rem" }}>{Math.round(f.utility_score * 100)}%</td>
                <td style={{ fontSize: "0.8125rem" }}>{f.evidence_count}</td>
                <td style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(f.last_verified)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Insights ───────────────────────────────────────────────────────────

function InsightsTab({ siteId }: { siteId: string }) {
  const [insights, setInsights] = useState<IntelInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    intelV2.insights(siteId)
      .then(setInsights)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Loading insights…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {insights.length === 0 ? (
        <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>No insights yet.</p>
      ) : insights.map(ins => (
        <div key={ins.id} className="dash-card" style={{ borderLeft: `3px solid ${INSIGHT_BORDER[ins.insight_type] || "#666"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.625rem" }}>
            <div>
              <span className="badge badge-blue" style={{ marginRight: "0.5rem" }}>{ins.insight_type}</span>
              <span className={STATUS_BADGE[ins.status] || "badge badge-gray"}>{ins.status}</span>
            </div>
          </div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.5rem" }}>{ins.title}</div>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", lineHeight: 1.6, marginBottom: "0.75rem" }}>{ins.body}</p>
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginBottom: "0.25rem" }}>Impact: {ins.impact_score}/10</div>
            <Bar value={ins.impact_score} max={10} color={INSIGHT_BORDER[ins.insight_type] || "var(--dash-accent)"} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setToast(`Marked "${ins.title}" as actioned`)}
            >
              Actioned
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setToast(`Dismissed "${ins.title}"`)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Discoveries ────────────────────────────────────────────────────────

function DiscoveriesTab({ siteId }: { siteId: string }) {
  const [proposed, setProposed] = useState<IntelDiscovery[]>([]);
  const [decided, setDecided] = useState<IntelDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidedOpen, setDecidedOpen] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);

  const loadAll = async () => {
    if (!siteId) return;
    try {
      const [p, a, r] = await Promise.all([
        intelV2.discoveries(siteId, "proposed"),
        intelV2.discoveries(siteId, "approved"),
        intelV2.discoveries(siteId, "rejected"),
      ]);
      setProposed(p);
      setDecided([...a, ...r]);
    } catch {}
  };

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [siteId]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setDeciding(id);
    try {
      await intelV2.decideDiscovery(id, status);
      await loadAll();
    } catch {}
    setDeciding(null);
  };

  if (loading) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Loading discoveries…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>{proposed.length} pending decisions</div>

      {proposed.length === 0 ? (
        <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>No pending discoveries.</p>
      ) : proposed.map(d => (
        <div key={d.id} className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.375rem" }}>
                <span className="badge badge-yellow">{d.candidate_type}</span>
                {d.metrics?.evidence_count != null && (
                  <span className="badge badge-blue">{d.metrics.evidence_count} evidence</span>
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", fontFamily: "'JetBrains Mono', monospace" }}>{d.proposed_slug}</div>
              {d.metrics?.first_seen && (
                <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
                  First seen: {fmtDate(d.metrics.first_seen)} · Last: {fmtDate(d.metrics.last_seen)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <button
                className="btn btn-sm btn-primary"
                disabled={deciding === d.id}
                onClick={() => decide(d.id, "approved")}
              >
                Approve
              </button>
              <button
                className="btn btn-sm btn-ghost"
                disabled={deciding === d.id}
                onClick={() => decide(d.id, "rejected")}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}

      {decided.length > 0 && (
        <div>
          <button
            onClick={() => setDecidedOpen(v => !v)}
            style={{ background: "none", border: "none", color: "var(--dash-text-dim)", fontSize: "0.8125rem", cursor: "pointer", padding: "0.25rem 0" }}
          >
            {decidedOpen ? "▲" : "▶"} Decided ({decided.length})
          </button>
          {decidedOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
              {decided.map(d => (
                <div key={d.id} className="dash-card" style={{ opacity: 0.6 }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span className={STATUS_BADGE[d.status] || "badge badge-gray"}>{d.status}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem" }}>{d.proposed_slug}</span>
                    <span className="badge badge-blue">{d.candidate_type}</span>
                    {d.decided_at && <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginLeft: "auto" }}>{fmtDate(d.decided_at)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Research ───────────────────────────────────────────────────────────

function ResearchTab({ siteId }: { siteId: string }) {
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"analysis" | "research" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadRuns = () => {
    if (!siteId) return;
    intelV2.research(siteId).then(setRuns).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadRuns();
  }, [siteId]);

  const triggerAnalysis = async () => {
    setActionLoading("analysis");
    try {
      await intelV2.triggerAnalysis(siteId);
      setToast("Full analysis triggered!");
      loadRuns();
    } catch { setToast("Failed to trigger analysis"); }
    setActionLoading(null);
  };

  const triggerResearch = async () => {
    setActionLoading("research");
    try {
      await intelV2.triggerResearch(siteId);
      setToast("Research triggered!");
      loadRuns();
    } catch { setToast("Failed to trigger research"); }
    setActionLoading(null);
  };

  if (loading) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Loading research runs…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          className="btn btn-sm btn-primary"
          disabled={!!actionLoading}
          onClick={triggerAnalysis}
        >
          {actionLoading === "analysis" ? "Running…" : "Run Full Analysis"}
        </button>
        <button
          className="btn btn-sm btn-ghost"
          disabled={!!actionLoading}
          onClick={triggerResearch}
        >
          {actionLoading === "research" ? "Running…" : "Run Research Only"}
        </button>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="dash-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Task Type</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Tokens</th>
              <th>Searches</th>
              <th>Cost</th>
              <th>Duration</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--dash-text-dim)", padding: "1.5rem" }}>No research runs yet</td></tr>
            ) : runs.map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>{r.task_type}</td>
                <td><span className="badge badge-blue">{r.trigger}</span></td>
                <td><span className={STATUS_BADGE[r.status] || "badge badge-gray"}>{r.status}</span></td>
                <td style={{ fontSize: "0.8125rem" }}>{r.tokens_used?.toLocaleString() ?? "—"}</td>
                <td style={{ fontSize: "0.8125rem" }}>{r.search_calls ?? "—"}</td>
                <td style={{ fontSize: "0.8125rem" }}>{r.cost_usd != null ? fmtUsd(r.cost_usd) : "—"}</td>
                <td style={{ fontSize: "0.8125rem" }}>{fmtDuration(r.started_at, r.completed_at)}</td>
                <td style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(r.started_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = "landscape" | "facts" | "insights" | "discoveries" | "research";

const TABS: { id: Tab; label: string }[] = [
  { id: "landscape",   label: "Landscape" },
  { id: "facts",       label: "Facts" },
  { id: "insights",    label: "Insights" },
  { id: "discoveries", label: "Discoveries" },
  { id: "research",    label: "Research" },
];

function DiscoveryPageInner() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";
  const [tab, setTab] = useState<Tab>("landscape");

  // Stats
  const [stats, setStats] = useState({ entities: 0, facts: 0, insights: 0, discoveries: 0 });

  useEffect(() => {
    if (!siteId) return;
    Promise.allSettled([
      intelV2.entities(siteId),
      intelV2.facts(siteId),
      intelV2.insights(siteId),
      intelV2.discoveries(siteId, "proposed"),
    ]).then(([e, f, i, d]) => {
      setStats({
        entities: e.status === "fulfilled" ? e.value.length : 0,
        facts:    f.status === "fulfilled" ? f.value.length : 0,
        insights: i.status === "fulfilled" ? i.value.length : 0,
        discoveries: d.status === "fulfilled" ? d.value.length : 0,
      });
    });
  }, [siteId]);

  return (
    <div className="dash-content">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.375rem", letterSpacing: "-0.02em" }}>
            Intelligence Discovery
          </h1>
          <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
            Structured intelligence layer — entities, facts, insights & discoveries
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Entities",    value: stats.entities },
          { label: "Facts",       value: stats.facts },
          { label: "Insights",    value: stats.insights },
          { label: "Pending",     value: stats.discoveries },
        ].map(s => (
          <div key={s.label} className="dash-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--dash-accent)", fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "0.4rem 0.875rem",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: tab === t.id ? "var(--dash-accent)" : "var(--dash-border)",
              background: tab === t.id ? "var(--dash-accent-dim)" : "transparent",
              color: tab === t.id ? "var(--dash-accent)" : "var(--dash-text-dim)",
              fontSize: "0.8125rem",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* No site selected */}
      {!siteId && (
        <div className="dash-card" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--dash-text-dim)" }}>Select a site from the sidebar to view intelligence data.</p>
        </div>
      )}

      {/* Tab content */}
      {siteId && tab === "landscape"   && <LandscapeTab siteId={siteId} />}
      {siteId && tab === "facts"       && <FactsTab siteId={siteId} />}
      {siteId && tab === "insights"    && <InsightsTab siteId={siteId} />}
      {siteId && tab === "discoveries" && <DiscoveriesTab siteId={siteId} />}
      {siteId && tab === "research"    && <ResearchTab siteId={siteId} />}
    </div>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={<div className="dash-content"><p style={{ color: "var(--dash-text-dim)" }}>Loading…</p></div>}>
      <DiscoveryPageInner />
    </Suspense>
  );
}
