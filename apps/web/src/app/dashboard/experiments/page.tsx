import { Experiment, Opportunity } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";
const KEY = process.env.API_SECRET_KEY || "";
const h = { "x-api-key": KEY };

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const EXP_STATUS_BADGE: Record<string, string> = {
  planned:        "badge badge-gray",
  running:        "badge badge-blue",
  evaluated:      "badge badge-yellow",
  winner_declared:"badge badge-green",
  archived:       "badge badge-gray",
};

const INTENT_BADGE: Record<string, string> = {
  high:   "badge badge-green",
  medium: "badge badge-yellow",
  low:    "badge badge-gray",
};

const EXEC_STATUS_BADGE: Record<string, string> = {
  detected:  "badge badge-gray",
  evaluated: "badge badge-blue",
  planned:   "badge badge-blue",
  executing: "badge badge-yellow",
  measured:  "badge badge-green",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function trunc(str: string | null | undefined, max: number): string {
  if (!str) return "—";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function ExperimentsPage() {
  const [experimentsRes, opportunitiesRes] = await Promise.allSettled([
    fetch(`${API_URL}/api/experiments`, { headers: h, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${API_URL}/api/opportunities`, { headers: h, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);

  const experiments: Experiment[] =
    experimentsRes.status === "fulfilled" ? experimentsRes.value : [];
  const opportunities: Opportunity[] =
    opportunitiesRes.status === "fulfilled" ? opportunitiesRes.value : [];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total = experiments.length;
  const running = experiments.filter((e) => e.status === "running").length;
  const winnerDeclared = experiments.filter(
    (e) => e.status === "winner_declared"
  ).length;
  const evaluated = experiments.filter((e) => e.status === "evaluated").length;
  const archived = experiments.filter((e) => e.status === "archived").length;

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div>
        <h1 className="page-title">Experimentos</h1>
        <p className="text-sm mt-1" style={{ color: "var(--dash-text-dim)" }}>
          Oportunidades detectadas · hipótesis · resultados medidos
        </p>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total" value={total} />
        <StatCard label="Running" value={running} accent />
        <StatCard label="Winner" value={winnerDeclared} />
        <StatCard label="Evaluated" value={evaluated} />
        <StatCard label="Archived" value={archived} dim />
      </div>

      {/* ── Opportunities section ── */}
      <section className="space-y-4">
        <h2 className="section-title">
          Oportunidades detectadas{" "}
          <span
            className="mono text-sm font-normal ml-2"
            style={{ color: "var(--dash-text-dim)" }}
          >
            {opportunities.length}
          </span>
        </h2>

        {opportunities.length === 0 ? (
          <EmptyState text="Sin oportunidades todavía" hint="POST /api/opportunities" />
        ) : (
          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Intención</th>
                  <th>Query / Pain Point</th>
                  <th style={{ textAlign: "right" }}>Valor est.</th>
                  <th>Confianza</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr key={opp.id}>
                    <td>
                      <span className="badge badge-blue">
                        {opp.channel}
                      </span>
                    </td>
                    <td>
                      <span className={INTENT_BADGE[opp.intent] ?? "badge badge-gray"}>
                        {opp.intent}
                      </span>
                    </td>
                    <td
                      title={opp.query || opp.pain_point || ""}
                      style={{ maxWidth: 280 }}
                    >
                      <span style={{ color: "var(--dash-text)" }}>
                        {trunc(opp.query || opp.pain_point, 50)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="mono" style={{ color: "var(--dash-accent)" }}>
                        {opp.expected_value > 0
                          ? `$${opp.expected_value.toLocaleString("es")}`
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          opp.confidence === "high"
                            ? "mono"
                            : opp.confidence === "medium"
                            ? "mono"
                            : "mono"
                        }
                        style={{
                          color:
                            opp.confidence === "high"
                              ? "var(--dash-accent)"
                              : opp.confidence === "medium"
                              ? "var(--dash-warn)"
                              : "var(--dash-text-dim)",
                        }}
                      >
                        {opp.confidence}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          EXEC_STATUS_BADGE[opp.execution_status] ??
                          "badge badge-gray"
                        }
                      >
                        {opp.execution_status}
                      </span>
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--dash-text-dim)",
                        }}
                      >
                        {fmtDate(opp.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Experiments section ── */}
      <section className="space-y-4">
        <h2 className="section-title">
          Experimentos{" "}
          <span
            className="mono text-sm font-normal ml-2"
            style={{ color: "var(--dash-text-dim)" }}
          >
            {experiments.length}
          </span>
        </h2>

        {experiments.length === 0 ? (
          <EmptyState text="Sin experimentos todavía" hint="POST /api/experiments" />
        ) : (
          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Hipótesis</th>
                  <th>Métrica</th>
                  <th>Estado</th>
                  <th>Ventana</th>
                  <th>Visitas A/B</th>
                  <th>Ganador</th>
                  <th>Aprendizajes</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => (
                  <tr
                    key={exp.id}
                    style={
                      exp.status === "running"
                        ? { borderLeft: "2px solid var(--dash-accent)" }
                        : undefined
                    }
                  >
                    <td
                      title={exp.hypothesis}
                      style={{ maxWidth: 260 }}
                    >
                      <span style={{ color: "var(--dash-text)" }}>
                        {trunc(exp.hypothesis, 60)}
                      </span>
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--dash-text-dim)",
                        }}
                      >
                        {exp.target_metric || "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          EXP_STATUS_BADGE[exp.status] ?? "badge badge-gray"
                        }
                      >
                        {exp.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: "var(--dash-text-dim)" }}>
                        {exp.run_window_days} días
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: "var(--dash-text)" }}>
                        {exp.visits_a.toLocaleString()}/
                        {exp.visits_b.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      {exp.winner ? (
                        <span className="badge badge-green">{exp.winner}</span>
                      ) : (
                        <span style={{ color: "var(--dash-text-dim)" }}>—</span>
                      )}
                    </td>
                    <td
                      title={exp.learnings || ""}
                      style={{ maxWidth: 220 }}
                    >
                      {exp.learnings ? (
                        <span style={{ color: "var(--dash-text)" }}>
                          {trunc(exp.learnings, 50)}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontStyle: "italic",
                            color: "var(--dash-text-dim)",
                          }}
                        >
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--dash-text-dim)",
                        }}
                      >
                        {fmtDate(exp.created_at)}
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
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  dim,
}: {
  label: string;
  value: number;
  accent?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="dash-card">
      <div
        className="stat-value"
        style={
          dim
            ? { color: "var(--dash-text-dim)" }
            : accent
            ? undefined
            : undefined
        }
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div
      className="dash-card text-center py-10"
      style={{ color: "var(--dash-text-dim)" }}
    >
      <p className="text-sm">{text}</p>
      {hint && (
        <p
          className="mono mt-1"
          style={{ fontSize: "0.75rem", color: "var(--dash-muted)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
