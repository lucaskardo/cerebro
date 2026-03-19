"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Lead, ContentAsset } from "@/lib/api";
import { api } from "@/lib/api";
import ExportCSV from "@/components/dashboard/ExportCSV";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function isToday(iso: string) {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function intentColor(score: number) {
  if (score >= 7) return "var(--dash-accent)";
  if (score >= 4) return "var(--dash-warn)";
  return "var(--dash-text-dim)";
}
function statusColor(s: string | null) {
  if (!s) return "var(--dash-text-dim)";
  if (s === "qualified" || s === "accepted") return "var(--dash-accent)";
  if (s === "nurturing" || s === "delivered") return "var(--dash-warn)";
  if (s === "closed" || s === "rejected") return "var(--dash-danger)";
  return "var(--dash-text-dim)";
}

// ─── Lead detail modal ────────────────────────────────────────────────────────

function LeadModal({ lead, assetMap, onClose }: {
  lead: Lead;
  assetMap: Record<string, string>;
  onClose: () => void;
}) {
  const assetTitle = lead.asset_id ? (assetMap[lead.asset_id] ?? lead.asset_id.slice(0, 8) + "…") : null;
  const quizEntries = lead.quiz_responses ? Object.entries(lead.quiz_responses) : [];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--dash-card)", border: "1px solid var(--dash-border)", borderRadius: "12px", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", padding: "1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <div className="mono" style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dash-text)" }}>{lead.email}</div>
            {lead.nombre && <div style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.2rem" }}>{lead.nombre}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--dash-text-dim)", lineHeight: 1, padding: "0.25rem" }}>×</button>
        </div>

        {/* Key fields grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <Field label="Intent Score" value={
            <span style={{ fontWeight: 700, color: intentColor(lead.intent_score) }}>{lead.intent_score}/10</span>
          } />
          <Field label="Status" value={
            <span style={{ color: statusColor(lead.current_status) }}>{lead.current_status ?? "new"}</span>
          } />
          <Field label="Source (CTA)" value={lead.cta_variant ?? "—"} />
          <Field label="Date" value={fmtDateTime(lead.created_at)} />
        </div>

        {/* Asset */}
        {assetTitle && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "var(--dash-bg)", border: "1px solid var(--dash-border)", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dash-text-dim)", marginBottom: "0.25rem" }}>Article that brought the lead</div>
            <div style={{ fontSize: "0.8125rem", color: "var(--dash-accent)", fontWeight: 500 }}>{assetTitle}</div>
          </div>
        )}

        {/* Origin URL */}
        {lead.origen_url && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dash-text-dim)", marginBottom: "0.25rem" }}>Origin URL</div>
            <div className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", wordBreak: "break-all" }}>{lead.origen_url}</div>
          </div>
        )}

        {/* UTMs */}
        {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "var(--dash-bg)", border: "1px solid var(--dash-border)", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dash-text-dim)", marginBottom: "0.5rem" }}>UTM Parameters</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {lead.utm_source && <span className="badge badge-blue">source: {lead.utm_source}</span>}
              {lead.utm_medium && <span className="badge badge-blue">medium: {lead.utm_medium}</span>}
              {lead.utm_campaign && <span className="badge badge-blue">campaign: {lead.utm_campaign}</span>}
              {lead.utm_content && <span className="badge badge-blue">content: {lead.utm_content}</span>}
            </div>
          </div>
        )}

        {/* Quiz responses */}
        {quizEntries.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dash-text-dim)", marginBottom: "0.5rem" }}>Quiz Responses</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {quizEntries.map(([q, a]) => (
                <div key={q} style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--dash-text-dim)", flexShrink: 0, minWidth: "1.5rem" }}>→</span>
                  <span style={{ color: "var(--dash-text-dim)" }}>{q}:</span>
                  <span style={{ color: "var(--dash-text)", fontWeight: 500 }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tema interes */}
        {lead.tema_interes && (
          <Field label="Topic of interest" value={lead.tema_interes} />
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dash-text-dim)", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontSize: "0.8125rem", color: "var(--dash-text)" }}>{value}</div>
    </div>
  );
}

// ─── Main leads table ─────────────────────────────────────────────────────────

function LeadsContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assetMap, setAssetMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.leads(siteId || undefined),
      api.content(undefined, siteId || undefined),
    ]).then(([leadsData, assets]) => {
      setLeads(leadsData);
      const map: Record<string, string> = {};
      (assets as ContentAsset[]).forEach((a) => { map[a.id] = a.title; });
      setAssetMap(map);
      setLoading(false);
    }).catch((e) => { setError(String(e)); setLoading(false); });
  }, [siteId]);

  const sorted = [...leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const totalLeads = leads.length;
  const todayLeads = leads.filter((l) => isToday(l.created_at)).length;
  const qualifiedLeads = leads.filter((l) => l.intent_score >= 7).length;
  const avgIntent = leads.length > 0 ? (leads.reduce((s, l) => s + l.intent_score, 0) / leads.length).toFixed(1) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {selectedLead && (
        <LeadModal lead={selectedLead} assetMap={assetMap} onClose={() => setSelectedLead(null)} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <h1 className="page-title">Leads</h1>
        <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>{totalLeads}</span>
        <div style={{ marginLeft: "auto" }}>
          <ExportCSV data={sorted as unknown as Record<string, unknown>[]} filename="leads.csv" label="Export CSV" />
        </div>
      </div>

      {error && <div style={{ background: "#ff4d4d18", border: "1px solid #ff4d4d33", borderRadius: "8px", padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--dash-danger)" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : totalLeads}</div><div className="stat-label">Total Leads</div></div>
        <div className="dash-card"><div className="stat-value" style={{ color: todayLeads > 0 ? "var(--dash-accent)" : "var(--dash-text-dim)" }}>{loading ? "…" : todayLeads}</div><div className="stat-label">Today</div></div>
        <div className="dash-card"><div className="stat-value" style={{ color: qualifiedLeads > 0 ? "var(--dash-accent)" : "var(--dash-text-dim)" }}>{loading ? "…" : qualifiedLeads}</div><div className="stat-label">Qualified (≥7)</div></div>
        <div className="dash-card"><div className="stat-value" style={{ color: "var(--dash-text)" }}>{loading ? "…" : avgIntent}</div><div className="stat-label">Avg Intent Score</div></div>
      </div>

      {loading ? (
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.25rem" }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
        </div>
      ) : sorted.length > 0 ? (
        <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th style={{ textAlign: "center" }}>Score</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Asset</th>
                  <th style={{ textAlign: "right" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((lead) => {
                  const assetTitle = lead.asset_id ? (assetMap[lead.asset_id] ?? null) : null;
                  return (
                    <tr
                      key={lead.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td><span className="mono" style={{ fontSize: "0.75rem" }}>{lead.email}</span></td>
                      <td style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>{lead.nombre ?? "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mono" style={{ fontSize: "0.8125rem", fontWeight: 700, color: intentColor(lead.intent_score) }}>{lead.intent_score}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem", color: statusColor(lead.current_status) }}>{lead.current_status ?? "new"}</span>
                      </td>
                      <td>
                        {lead.cta_variant
                          ? <span className="badge badge-blue">{lead.cta_variant}</span>
                          : <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>—</span>}
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", maxWidth: "12rem" }}>
                        {assetTitle
                          ? <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={assetTitle}>{assetTitle}</span>
                          : <span>—</span>}
                      </td>
                      <td className="mono" style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(lead.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", color: "var(--dash-text-dim)", borderTop: "1px solid var(--dash-border)" }}>
            Click any row to view full lead details
          </div>
        </div>
      ) : !error && (
        <div className="dash-card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--dash-text-dim)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.4 }}>◎</div>
          <p style={{ fontSize: "0.875rem" }}>No leads yet.</p>
          <p className="mono" style={{ fontSize: "0.75rem", marginTop: "0.5rem", color: "var(--dash-muted)" }}>POST /api/leads/capture to capture leads.</p>
        </div>
      )}
    </div>
  );
}

export default function LeadsDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <LeadsContent />
    </Suspense>
  );
}
