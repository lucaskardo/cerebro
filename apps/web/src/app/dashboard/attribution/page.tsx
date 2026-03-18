"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Funnel, LeadsByAsset, LeadsByBrand } from "@/lib/api";
import { api } from "@/lib/api";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pct(num: number, den: number): string {
  if (!den || den === 0) return "0%";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function trunc(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function NoData() {
  return (
    <div className="dash-card" style={{ textAlign: "center", padding: "2rem 1.5rem", color: "var(--dash-text-dim)" }}>
      <p style={{ fontSize: "0.875rem" }}>Sin datos</p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function AttributionContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";
  const days = 30;

  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [byAsset, setByAsset] = useState<LeadsByAsset[] | null>(null);
  const [byBrand, setByBrand] = useState<LeadsByBrand[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.funnelNew(days, siteId || undefined),
      api.leadsByAsset(days, siteId || undefined),
      api.leadsByBrand(days),
    ]).then(([fRes, aRes, bRes]) => {
      if (fRes.status === "fulfilled") setFunnel(fRes.value);
      if (aRes.status === "fulfilled") setByAsset(aRes.value);
      if (bRes.status === "fulfilled") setByBrand(bRes.value);
      setLoading(false);
    });
  }, [siteId]);

  const funnelSteps = funnel ? [
    { key: "visitors", label: "Visitantes", value: funnel.visitors ?? 0 },
    { key: "sessions", label: "Sesiones", value: funnel.sessions ?? 0 },
    { key: "leads", label: "Leads", value: funnel.leads ?? funnel.leads_captured ?? 0 },
    { key: "qualified", label: "Calificados", value: funnel.qualified ?? 0 },
    { key: "accepted", label: "Aceptados", value: funnel.accepted ?? 0 },
  ] : [];

  const maxStep = funnelSteps.reduce((m, s) => Math.max(m, s.value), 1);

  const totalPageviews = funnel?.pageviews ?? 0;
  const totalLeads = funnel?.leads ?? funnel?.leads_captured ?? 0;
  const totalQualified = funnel?.qualified ?? 0;
  const conversionRate = totalLeads > 0 ? `${((totalQualified / totalLeads) * 100).toFixed(1)}%` : "0%";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Atribución</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
          Últimos {days} días — tráfico → leads → conversiones
        </p>
      </div>

      {/* Funnel */}
      {loading ? (
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
        </div>
      ) : funnel ? (
        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="section-title">Funnel de conversión</h2>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
              {funnel.lead_rate != null && (
                <span>Tasa lead: <span className="mono" style={{ color: "var(--dash-text)" }}>{funnel.lead_rate}%</span></span>
              )}
              {funnel.qualify_rate != null && (
                <span>Tasa calif.: <span className="mono" style={{ color: "var(--dash-text)" }}>{funnel.qualify_rate}%</span></span>
              )}
            </div>
          </div>

          <div className="dash-card">
            {/* Horizontal flow */}
            <div style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto" }}>
              {funnelSteps.map((step, i) => {
                const prev = i > 0 ? funnelSteps[i - 1].value : step.value;
                const dropoff = i > 0 && prev > 0 ? Math.round((1 - step.value / prev) * 100) : null;
                const hasData = step.value > 0;
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 90 }}>
                    <div style={{
                      flex: 1,
                      background: hasData ? "var(--dash-accent-dim)" : "var(--dash-surface)",
                      border: `1px solid ${hasData ? "var(--dash-accent)" : "var(--dash-border)"}`,
                      borderRadius: 8,
                      padding: "1rem 0.75rem",
                      textAlign: "center",
                    }}>
                      <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: hasData ? "var(--dash-accent)" : "var(--dash-text-dim)", lineHeight: 1, marginBottom: "0.375rem" }}>
                        {step.value.toLocaleString("es")}
                      </div>
                      <div style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--dash-text-dim)" }}>
                        {step.label}
                      </div>
                    </div>
                    {i < funnelSteps.length - 1 && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 6px", gap: 2, flexShrink: 0 }}>
                        <span style={{ color: "var(--dash-border-hi)", fontSize: "1.25rem", lineHeight: 1 }}>→</span>
                        {dropoff !== null && dropoff > 0 && (
                          <span className="mono" style={{ fontSize: "0.625rem", color: "var(--dash-danger)", opacity: 0.7 }}>−{dropoff}%</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bar chart */}
            {maxStep > 0 && (
              <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {funnelSteps.map((step) => (
                  <div key={step.key + "-bar"}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--dash-text-dim)", marginBottom: "0.25rem" }}>
                      <span>{step.label}</span>
                      <span className="mono" style={{ color: "var(--dash-text)" }}>{step.value.toLocaleString("es")}</span>
                    </div>
                    <div style={{ width: "100%", background: "var(--dash-border)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.max(1, (step.value / maxStep) * 100)}%`,
                        background: "var(--dash-accent)",
                        height: "100%",
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                        opacity: step.value > 0 ? 1 : 0.2,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="dash-card" style={{ textAlign: "center", padding: "2rem 1.5rem", color: "var(--dash-text-dim)" }}>
          <p style={{ fontSize: "0.875rem" }}>Sin datos de funnel</p>
          <p className="mono" style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--dash-muted)" }}>
            GET /api/reports/funnel devolvió sin datos
          </p>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <StatCard label="Total Pageviews" value={loading ? "…" : totalPageviews.toLocaleString("es")} />
        <StatCard label="Leads capturados" value={loading ? "…" : totalLeads.toLocaleString("es")} />
        <StatCard label="Leads calificados" value={loading ? "…" : totalQualified.toLocaleString("es")} />
        <StatCard label="Tasa conversión" value={loading ? "…" : conversionRate} />
      </div>

      {/* Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 className="section-title">Leads por artículo</h2>
          {loading ? <div className="skeleton" style={{ height: "8rem" }} /> :
            !byAsset || byAsset.length === 0 ? <NoData /> : (
              <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="dash-table">
                  <thead><tr><th>Asset ID</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Calif.</th><th style={{ textAlign: "right" }}>% Calif.</th></tr></thead>
                  <tbody>
                    {byAsset.slice(0, 10).map((row) => (
                      <tr key={row.asset_id}>
                        <td><span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }} title={row.asset_id}>{trunc(row.asset_id, 8)}</span></td>
                        <td style={{ textAlign: "right" }}><span className="mono" style={{ color: "var(--dash-text)" }}>{row.total}</span></td>
                        <td style={{ textAlign: "right" }}><span className="mono" style={{ color: "var(--dash-accent)" }}>{row.qualified}</span></td>
                        <td style={{ textAlign: "right" }}>
                          <span className="mono" style={{ fontSize: "0.75rem", color: row.total > 0 && row.qualified / row.total > 0.5 ? "var(--dash-accent)" : "var(--dash-text-dim)" }}>
                            {pct(row.qualified, row.total)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 className="section-title">Leads por marca</h2>
          {loading ? <div className="skeleton" style={{ height: "8rem" }} /> :
            !byBrand || byBrand.length === 0 ? <NoData /> : (
              <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="dash-table">
                  <thead><tr><th>Site ID</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Calif.</th></tr></thead>
                  <tbody>
                    {byBrand.slice(0, 10).map((row) => (
                      <tr key={row.site_id}>
                        <td><span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }} title={row.site_id}>{trunc(row.site_id, 8)}</span></td>
                        <td style={{ textAlign: "right" }}><span className="mono" style={{ color: "var(--dash-text)" }}>{row.total}</span></td>
                        <td style={{ textAlign: "right" }}><span className="mono" style={{ color: "var(--dash-accent)" }}>{row.qualified}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>
    </div>
  );
}

export default function AttributionDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <AttributionContent />
    </Suspense>
  );
}
