import type { Lead } from "@/lib/api";
import ExportCSV from "@/components/dashboard/ExportCSV";

// ── Auth-aware fetch (server-side only) ───────────────────────────────────────

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";

async function fetchLeads(): Promise<Lead[]> {
  const headers: HeadersInit = {
    "x-api-key": process.env.API_SECRET_KEY || "",
  };
  const res = await fetch(`${API_URL}/api/leads`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}: /api/leads`);
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function intentBadge(score: number): { cls: string; label: string } {
  if (score >= 7) return { cls: "badge badge-green", label: `${score}/10` };
  if (score >= 4) return { cls: "badge badge-yellow", label: `${score}/10` };
  return { cls: "badge badge-gray", label: `${score}/10` };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LeadsDashboardPage() {
  let leads: Lead[] = [];
  let fetchError: string | null = null;

  try {
    leads = await fetchLeads();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Error fetching leads";
    leads = [];
  }

  // Sort descending by created_at
  const sorted = [...leads].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Stats
  const totalLeads     = leads.length;
  const todayLeads     = leads.filter((l) => isToday(l.created_at)).length;
  const qualifiedLeads = leads.filter((l) => l.intent_score >= 7).length;
  const avgIntent      =
    leads.length > 0
      ? (leads.reduce((sum, l) => sum + l.intent_score, 0) / leads.length).toFixed(1)
      : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <h1 className="page-title">Leads</h1>
        <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>
          {totalLeads}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <ExportCSV
            data={sorted as unknown as Record<string, unknown>[]}
            filename="leads.csv"
            label="Export CSV"
          />
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────── */}
      {fetchError && (
        <div
          style={{
            background: "#ff4d4d18",
            border: "1px solid #ff4d4d33",
            borderRadius: "8px",
            padding: "0.875rem 1rem",
            fontSize: "0.8125rem",
            color: "var(--dash-danger)",
          }}
        >
          {fetchError}
        </div>
      )}

      {/* ── Stats row ───────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.875rem",
        }}
      >
        {/* Total */}
        <div className="dash-card">
          <div className="stat-value">{totalLeads}</div>
          <div className="stat-label">Total Leads</div>
        </div>

        {/* Today */}
        <div className="dash-card">
          <div
            className="stat-value"
            style={{
              color: todayLeads > 0 ? "var(--dash-accent)" : "var(--dash-text-dim)",
            }}
          >
            {todayLeads}
          </div>
          <div className="stat-label">Today</div>
        </div>

        {/* Qualified */}
        <div className="dash-card">
          <div
            className="stat-value"
            style={{
              color: qualifiedLeads > 0 ? "var(--dash-accent)" : "var(--dash-text-dim)",
            }}
          >
            {qualifiedLeads}
          </div>
          <div className="stat-label">Qualified (intent ≥ 7)</div>
        </div>

        {/* Avg intent */}
        <div className="dash-card">
          <div
            className="stat-value"
            style={{ color: "var(--dash-text)" }}
          >
            {avgIntent}
          </div>
          <div className="stat-label">Avg Intent Score</div>
        </div>
      </div>

      {/* ── Leads table ─────────────────────────────────────────── */}
      {sorted.length > 0 ? (
        <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombre</th>
                  <th style={{ textAlign: "center" }}>Intent Score</th>
                  <th>Tema de Interés</th>
                  <th>UTM Source</th>
                  <th style={{ textAlign: "right" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((lead) => {
                  const badge = intentBadge(lead.intent_score);
                  return (
                    <tr key={lead.id}>
                      {/* Email */}
                      <td>
                        <span
                          className="mono"
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--dash-text)",
                          }}
                        >
                          {lead.email}
                        </span>
                      </td>

                      {/* Nombre */}
                      <td style={{ color: "var(--dash-text-dim)" }}>
                        {lead.nombre ?? "—"}
                      </td>

                      {/* Intent Score — mono number + colored badge */}
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.375rem",
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.75rem",
                              color:
                                lead.intent_score >= 7
                                  ? "var(--dash-accent)"
                                  : lead.intent_score >= 4
                                  ? "var(--dash-warn)"
                                  : "var(--dash-text-dim)",
                              fontWeight: 600,
                            }}
                          >
                            {lead.intent_score}
                          </span>
                          <span className={badge.cls}>{badge.label}</span>
                        </div>
                      </td>

                      {/* Tema de Interés */}
                      <td
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--dash-text-dim)",
                          maxWidth: "14rem",
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                          }}
                        >
                          {lead.tema_interes ?? "—"}
                        </span>
                      </td>

                      {/* UTM Source */}
                      <td>
                        {lead.utm_source ? (
                          <span className="badge badge-blue">
                            {lead.utm_source}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--dash-text-dim)",
                            }}
                          >
                            directo
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td
                        className="mono"
                        style={{
                          textAlign: "right",
                          fontSize: "0.75rem",
                          color: "var(--dash-text-dim)",
                        }}
                      >
                        {fmtDate(lead.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !fetchError && (
          <div
            className="dash-card"
            style={{
              textAlign: "center",
              padding: "3rem 1.5rem",
              color: "var(--dash-text-dim)",
            }}
          >
            <div
              style={{
                fontSize: "2rem",
                marginBottom: "0.75rem",
                opacity: 0.4,
              }}
            >
              ◎
            </div>
            <p style={{ fontSize: "0.875rem" }}>No leads yet.</p>
            <p
              className="mono"
              style={{
                fontSize: "0.75rem",
                marginTop: "0.5rem",
                color: "var(--dash-muted)",
              }}
            >
              POST /api/leads/capture to capture leads.
            </p>
          </div>
        )
      )}
    </div>
  );
}
