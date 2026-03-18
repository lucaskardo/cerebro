"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Experiment, Opportunity } from "@/lib/api";
import { api } from "@/lib/api";

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const EXP_STATUS_BADGE: Record<string, string> = {
  planned:         "badge badge-gray",
  running:         "badge badge-blue",
  evaluated:       "badge badge-yellow",
  winner_declared: "badge badge-green",
  archived:        "badge badge-gray",
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
    return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return iso.slice(0, 10);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, accent, dim }: { label: string; value: number; accent?: boolean; dim?: boolean }) {
  return (
    <div className="dash-card">
      <div className="stat-value" style={dim ? { color: "var(--dash-text-dim)" } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="dash-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem", color: "var(--dash-text-dim)" }}>
      <p style={{ fontSize: "0.875rem" }}>{text}</p>
      {hint && <p className="mono" style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--dash-muted)" }}>{hint}</p>}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function ExperimentsContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.experiments(siteId ? { site_id: siteId } : undefined),
      api.opportunities(siteId ? { site_id: siteId } : undefined),
    ]).then(([expRes, oppRes]) => {
      if (expRes.status === "fulfilled") setExperiments(expRes.value);
      if (oppRes.status === "fulfilled") setOpportunities(oppRes.value);
      setLoading(false);
    });
  }, [siteId]);

  const total = experiments.length;
  const running = experiments.filter((e) => e.status === "running").length;
  const winnerDeclared = experiments.filter((e) => e.status === "winner_declared").length;
  const evaluated = experiments.filter((e) => e.status === "evaluated").length;
  const archived = experiments.filter((e) => e.status === "archived").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Experimentos</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
          Oportunidades detectadas · hipótesis · resultados medidos
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.875rem" }}>
        <StatCard label="Total" value={loading ? 0 : total} />
        <StatCard label="Running" value={loading ? 0 : running} accent />
        <StatCard label="Winner" value={loading ? 0 : winnerDeclared} />
        <StatCard label="Evaluated" value={loading ? 0 : evaluated} />
        <StatCard label="Archived" value={loading ? 0 : archived} dim />
      </div>

      {/* Opportunities */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="section-title">
          Oportunidades detectadas{" "}
          <span className="mono" style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--dash-text-dim)", marginLeft: "0.5rem" }}>
            {loading ? "…" : opportunities.length}
          </span>
        </h2>
        {loading ? (
          <div className="dash-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
          </div>
        ) : opportunities.length === 0 ? (
          <EmptyState text="Sin oportunidades todavía" hint="POST /api/opportunities" />
        ) : (
          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Canal</th><th>Intención</th><th>Query / Pain Point</th>
                  <th style={{ textAlign: "right" }}>Valor est.</th><th>Confianza</th><th>Estado</th><th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr key={opp.id}>
                    <td><span className="badge badge-blue">{opp.channel}</span></td>
                    <td><span className={INTENT_BADGE[opp.intent] ?? "badge badge-gray"}>{opp.intent}</span></td>
                    <td title={opp.query || opp.pain_point || ""} style={{ maxWidth: 280 }}>
                      <span style={{ color: "var(--dash-text)" }}>{trunc(opp.query || opp.pain_point, 50)}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="mono" style={{ color: "var(--dash-accent)" }}>
                        {opp.expected_value > 0 ? `$${opp.expected_value.toLocaleString("es")}` : "—"}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: opp.confidence === "high" ? "var(--dash-accent)" : opp.confidence === "medium" ? "var(--dash-warn)" : "var(--dash-text-dim)" }}>
                        {opp.confidence}
                      </span>
                    </td>
                    <td><span className={EXEC_STATUS_BADGE[opp.execution_status] ?? "badge badge-gray"}>{opp.execution_status}</span></td>
                    <td><span className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{fmtDate(opp.created_at)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Experiments */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="section-title">
          Experimentos{" "}
          <span className="mono" style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--dash-text-dim)", marginLeft: "0.5rem" }}>
            {loading ? "…" : experiments.length}
          </span>
        </h2>
        {loading ? (
          <div className="dash-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
          </div>
        ) : experiments.length === 0 ? (
          <EmptyState text="Sin experimentos todavía" hint="POST /api/experiments" />
        ) : (
          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Hipótesis</th><th>Métrica</th><th>Estado</th><th>Ventana</th>
                  <th>Visitas A/B</th><th>Ganador</th><th>Aprendizajes</th><th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => (
                  <tr key={exp.id} style={exp.status === "running" ? { borderLeft: "2px solid var(--dash-accent)" } : undefined}>
                    <td title={exp.hypothesis} style={{ maxWidth: 260 }}>
                      <span style={{ color: "var(--dash-text)" }}>{trunc(exp.hypothesis, 60)}</span>
                    </td>
                    <td><span className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{exp.target_metric || "—"}</span></td>
                    <td><span className={EXP_STATUS_BADGE[exp.status] ?? "badge badge-gray"}>{exp.status.replace("_", " ")}</span></td>
                    <td><span className="mono" style={{ color: "var(--dash-text-dim)" }}>{exp.run_window_days} días</span></td>
                    <td><span className="mono" style={{ color: "var(--dash-text)" }}>{exp.visits_a.toLocaleString()}/{exp.visits_b.toLocaleString()}</span></td>
                    <td>
                      {exp.winner ? <span className="badge badge-green">{exp.winner}</span> : <span style={{ color: "var(--dash-text-dim)" }}>—</span>}
                    </td>
                    <td title={exp.learnings || ""} style={{ maxWidth: 220 }}>
                      {exp.learnings ? (
                        <span style={{ color: "var(--dash-text)" }}>{trunc(exp.learnings, 50)}</span>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "var(--dash-text-dim)" }}>Pendiente</span>
                      )}
                    </td>
                    <td><span className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{fmtDate(exp.created_at)}</span></td>
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

export default function ExperimentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <ExperimentsContent />
    </Suspense>
  );
}
