"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Lead } from "@/lib/api";
import { api } from "@/lib/api";
import ExportCSV from "@/components/dashboard/ExportCSV";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function isToday(iso: string) {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function intentBadge(score: number): { cls: string; label: string } {
  if (score >= 7) return { cls: "badge badge-green", label: `${score}/10` };
  if (score >= 4) return { cls: "badge badge-yellow", label: `${score}/10` };
  return { cls: "badge badge-gray", label: `${score}/10` };
}

function LeadsContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.leads(siteId || undefined).then((data) => { setLeads(data); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [siteId]);

  const sorted = [...leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const totalLeads = leads.length;
  const todayLeads = leads.filter((l) => isToday(l.created_at)).length;
  const qualifiedLeads = leads.filter((l) => l.intent_score >= 7).length;
  const avgIntent = leads.length > 0 ? (leads.reduce((s, l) => s + l.intent_score, 0) / leads.length).toFixed(1) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
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
                <tr><th>Email</th><th>Nombre</th><th style={{ textAlign: "center" }}>Intent</th><th>Tema</th><th>UTM</th><th style={{ textAlign: "right" }}>Date</th></tr>
              </thead>
              <tbody>
                {sorted.map((lead) => {
                  const badge = intentBadge(lead.intent_score);
                  return (
                    <tr key={lead.id}>
                      <td><span className="mono" style={{ fontSize: "0.75rem" }}>{lead.email}</span></td>
                      <td style={{ color: "var(--dash-text-dim)" }}>{lead.nombre ?? "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className="mono" style={{ fontSize: "0.75rem", fontWeight: 600, color: lead.intent_score >= 7 ? "var(--dash-accent)" : lead.intent_score >= 4 ? "var(--dash-warn)" : "var(--dash-text-dim)" }}>{lead.intent_score}</span>
                        {" "}<span className={badge.cls}>{badge.label}</span>
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", maxWidth: "14rem" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{lead.tema_interes ?? "—"}</span>
                      </td>
                      <td>{lead.utm_source ? <span className="badge badge-blue">{lead.utm_source}</span> : <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>directo</span>}</td>
                      <td className="mono" style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(lead.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
