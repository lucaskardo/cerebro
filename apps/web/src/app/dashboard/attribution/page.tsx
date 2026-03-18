import { Funnel, LeadsByAsset, LeadsByBrand } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";
const KEY = process.env.API_SECRET_KEY || "";
const h = { "x-api-key": KEY };

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: h, cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pct(num: number, den: number): string {
  if (!den || den === 0) return "0%";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function trunc(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AttributionDashboardPage() {
  const days = 30;

  const [funnel, byAsset, byBrand] = await Promise.all([
    safeFetch<Funnel>(`${API_URL}/api/reports/funnel?days=${days}`),
    safeFetch<LeadsByAsset[]>(`${API_URL}/api/reports/leads-by-asset?days=${days}`),
    safeFetch<LeadsByBrand[]>(`${API_URL}/api/reports/leads-by-brand?days=${days}`),
  ]);

  // ── Funnel step definitions ────────────────────────────────────────────────
  const funnelSteps: { key: string; label: string; value: number }[] = funnel
    ? [
        { key: "visitors", label: "Visitantes", value: funnel.visitors ?? 0 },
        { key: "sessions", label: "Sesiones", value: funnel.sessions ?? 0 },
        { key: "leads", label: "Leads", value: funnel.leads ?? funnel.leads_captured ?? 0 },
        { key: "qualified", label: "Calificados", value: funnel.qualified ?? 0 },
        { key: "accepted", label: "Aceptados", value: funnel.accepted ?? 0 },
      ]
    : [];

  const maxStep = funnelSteps.reduce((m, s) => Math.max(m, s.value), 1);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalPageviews = funnel?.pageviews ?? 0;
  const totalLeads = funnel?.leads ?? funnel?.leads_captured ?? 0;
  const totalQualified = funnel?.qualified ?? 0;
  const conversionRate =
    totalLeads > 0
      ? `${((totalQualified / totalLeads) * 100).toFixed(1)}%`
      : "0%";

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div>
        <h1 className="page-title">Atribución</h1>
        <p className="text-sm mt-1" style={{ color: "var(--dash-text-dim)" }}>
          Últimos {days} días — tráfico → leads → conversiones
        </p>
      </div>

      {/* ── Funnel visualization ── */}
      {funnel ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Funnel de conversión</h2>
            <div
              className="flex gap-4 text-xs"
              style={{ color: "var(--dash-text-dim)" }}
            >
              {funnel.lead_rate != null && (
                <span>
                  Tasa lead:{" "}
                  <span
                    className="mono"
                    style={{ color: "var(--dash-text)" }}
                  >
                    {funnel.lead_rate}%
                  </span>
                </span>
              )}
              {funnel.qualify_rate != null && (
                <span>
                  Tasa calif.:{" "}
                  <span
                    className="mono"
                    style={{ color: "var(--dash-text)" }}
                  >
                    {funnel.qualify_rate}%
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Horizontal flow bar */}
          <div className="dash-card">
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                overflowX: "auto",
              }}
            >
              {funnelSteps.map((step, i) => {
                const prev = i > 0 ? funnelSteps[i - 1].value : step.value;
                const dropoff =
                  i > 0 && prev > 0
                    ? Math.round((1 - step.value / prev) * 100)
                    : null;
                const hasData = step.value > 0;

                return (
                  <div
                    key={step.key}
                    style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 90 }}
                  >
                    {/* Step box */}
                    <div
                      style={{
                        flex: 1,
                        background: hasData
                          ? "var(--dash-accent-dim)"
                          : "var(--dash-surface)",
                        border: `1px solid ${hasData ? "var(--dash-accent)" : "var(--dash-border)"}`,
                        borderRadius: 8,
                        padding: "1rem 0.75rem",
                        textAlign: "center",
                        transition: "border-color 0.15s",
                      }}
                    >
                      <div
                        className="mono"
                        style={{
                          fontSize: "1.5rem",
                          fontWeight: 700,
                          color: hasData
                            ? "var(--dash-accent)"
                            : "var(--dash-text-dim)",
                          lineHeight: 1,
                          marginBottom: "0.375rem",
                        }}
                      >
                        {step.value.toLocaleString("es")}
                      </div>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "var(--dash-text-dim)",
                        }}
                      >
                        {step.label}
                      </div>
                    </div>

                    {/* Arrow + dropoff between steps */}
                    {i < funnelSteps.length - 1 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "0 6px",
                          gap: 2,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            color: "var(--dash-border-hi)",
                            fontSize: "1.25rem",
                            lineHeight: 1,
                          }}
                        >
                          →
                        </span>
                        {dropoff !== null && dropoff > 0 && (
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.625rem",
                              color: "var(--dash-danger)",
                              opacity: 0.7,
                            }}
                          >
                            −{dropoff}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bar chart below flow */}
            {maxStep > 0 && (
              <div className="space-y-2 mt-6">
                {funnelSteps.map((step) => (
                  <div key={step.key + "-bar"} className="space-y-1">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        color: "var(--dash-text-dim)",
                      }}
                    >
                      <span>{step.label}</span>
                      <span
                        className="mono"
                        style={{ color: "var(--dash-text)" }}
                      >
                        {step.value.toLocaleString("es")}
                      </span>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        background: "var(--dash-border)",
                        borderRadius: 4,
                        height: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(1, (step.value / maxStep) * 100)}%`,
                          background: "var(--dash-accent)",
                          height: "100%",
                          borderRadius: 4,
                          transition: "width 0.3s ease",
                          opacity: step.value > 0 ? 1 : 0.2,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="dash-card text-center py-8" style={{ color: "var(--dash-text-dim)" }}>
          <p className="text-sm">Sin datos de funnel</p>
          <p className="mono mt-1" style={{ fontSize: "0.75rem", color: "var(--dash-muted)" }}>
            GET /api/reports/funnel devolvió sin datos
          </p>
        </div>
      )}

      {/* ── Stats cards row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Pageviews" value={totalPageviews.toLocaleString("es")} />
        <StatCard label="Leads capturados" value={totalLeads.toLocaleString("es")} />
        <StatCard label="Leads calificados" value={totalQualified.toLocaleString("es")} />
        <StatCard label="Tasa conversión" value={conversionRate} />
      </div>

      {/* ── Tables row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Asset */}
        <section className="space-y-3">
          <h2 className="section-title">Leads por artículo</h2>
          {!byAsset || byAsset.length === 0 ? (
            <NoData />
          ) : (
            <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Calif.</th>
                    <th style={{ textAlign: "right" }}>% Calif.</th>
                  </tr>
                </thead>
                <tbody>
                  {byAsset.slice(0, 10).map((row) => (
                    <tr key={row.asset_id}>
                      <td>
                        <span
                          className="mono"
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--dash-text-dim)",
                          }}
                          title={row.asset_id}
                        >
                          {trunc(row.asset_id, 8)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="mono" style={{ color: "var(--dash-text)" }}>
                          {row.total}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="mono"
                          style={{ color: "var(--dash-accent)" }}
                        >
                          {row.qualified}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: "0.75rem",
                            color:
                              row.total > 0 &&
                              row.qualified / row.total > 0.5
                                ? "var(--dash-accent)"
                                : "var(--dash-text-dim)",
                          }}
                        >
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

        {/* Leads by Brand */}
        <section className="space-y-3">
          <h2 className="section-title">Leads por marca</h2>
          {!byBrand || byBrand.length === 0 ? (
            <NoData />
          ) : (
            <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Site ID</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Calif.</th>
                  </tr>
                </thead>
                <tbody>
                  {byBrand.slice(0, 10).map((row) => (
                    <tr key={row.site_id}>
                      <td>
                        <span
                          className="mono"
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--dash-text-dim)",
                          }}
                          title={row.site_id}
                        >
                          {trunc(row.site_id, 8)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="mono" style={{ color: "var(--dash-text)" }}>
                          {row.total}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="mono"
                          style={{ color: "var(--dash-accent)" }}
                        >
                          {row.qualified}
                        </span>
                      </td>
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
    <div
      className="dash-card text-center py-8"
      style={{ color: "var(--dash-text-dim)" }}
    >
      <p className="text-sm">Sin datos</p>
    </div>
  );
}
