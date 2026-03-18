"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Goal, Strategy } from "@/lib/api";
import { api } from "@/lib/api";

const GOAL_STATUS_BADGE: Record<string, string> = {
  active: "badge badge-green", achieved: "badge badge-blue", paused: "badge badge-gray",
};
const STRATEGY_STATUS_BADGE: Record<string, string> = {
  proposed: "badge badge-gray", approved: "badge badge-green",
  running: "badge badge-blue", completed: "badge badge-green", failed: "badge badge-red",
};
const CHANNEL_BADGE: Record<string, string> = {
  seo: "badge badge-green", social: "badge badge-blue", community: "badge badge-yellow",
  email: "badge badge-gray", outreach: "badge badge-gray", messaging: "badge badge-gray",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function StrategyContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";
  const [goals, setGoals] = useState<Goal[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([api.goals(), api.strategies()]).then(([g, s]) => {
      if (g.status === "fulfilled") setGoals(g.value);
      if (s.status === "fulfilled") setStrategies(s.value);
      setLoading(false);
    });
  }, [siteId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h1 className="page-title">Estrategia</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>Goals activos y estrategias propuestas por el sistema</p>
      </div>

      {/* Goals */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <h2 className="section-title">Goals</h2>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6875rem", padding: "0.15rem 0.45rem", borderRadius: "4px", background: "var(--dash-accent-dim)", color: "var(--dash-accent)" }}>
            {loading ? "…" : goals.length}
          </span>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.875rem" }}>
            {[...Array(2)].map((_, i) => <div key={i} className="dash-card skeleton" style={{ height: "7rem" }} />)}
          </div>
        ) : goals.length === 0 ? (
          <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "10px" }}>
            No hay goals. <span className="mono" style={{ fontSize: "0.75rem" }}>POST /api/goals</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.875rem" }}>
            {goals.map((goal) => {
              const progress = goal.target_value > 0 ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0;
              return (
                <div key={goal.id} className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--dash-text)", lineHeight: 1.4 }}>{goal.description}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
                        <span className="mono">{goal.target_metric}</span> · <span className="mono">{goal.current_value} / {goal.target_value}</span>
                      </p>
                    </div>
                    <span className={GOAL_STATUS_BADGE[goal.status] ?? "badge badge-gray"} style={{ flexShrink: 0 }}>{goal.status}</span>
                  </div>
                  <div>
                    <div style={{ width: "100%", background: "var(--dash-border)", borderRadius: "9999px", height: "6px", overflow: "hidden" }}>
                      <div style={{ width: `${progress}%`, background: "var(--dash-accent)", height: "100%", borderRadius: "9999px", transition: "width 0.3s ease" }} />
                    </div>
                    <p style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", marginTop: "0.3rem" }}>{progress}% completado</p>
                  </div>
                  <p style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>Creado {fmtDate(goal.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Strategies */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <h2 className="section-title">Estrategias propuestas</h2>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6875rem", padding: "0.15rem 0.45rem", borderRadius: "4px", background: "var(--dash-accent-dim)", color: "var(--dash-accent)" }}>
            {loading ? "…" : strategies.length}
          </span>
        </div>

        <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
            </div>
          ) : strategies.length === 0 ? (
            <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
              No hay estrategias. Crea un goal y genera estrategias desde la API.
            </div>
          ) : (
            <table className="dash-table">
              <thead><tr><th>Nombre</th><th>Canal</th><th>Est. Leads</th><th>Confianza</th><th>Estado</th><th>Creado</th></tr></thead>
              <tbody>
                {strategies.map((s) => {
                  const confColor = s.confidence_score >= 70 ? "var(--dash-accent)" : s.confidence_score >= 40 ? "#f59e0b" : "#ff4d4d";
                  return (
                    <tr key={s.id}>
                      <td style={{ maxWidth: "260px" }}>
                        <div style={{ fontWeight: 500, color: "var(--dash-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</div>
                        {s.description && <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.description}>{s.description}</div>}
                      </td>
                      <td><span className={CHANNEL_BADGE[s.channel] ?? "badge badge-gray"}>{s.channel}</span></td>
                      <td><span className="mono" style={{ fontWeight: 600, color: "var(--dash-accent)" }}>{s.estimated_leads}</span></td>
                      <td><span className="mono" style={{ fontWeight: 600, color: confColor }}>{s.confidence_score}%</span></td>
                      <td><span className={STRATEGY_STATUS_BADGE[s.status] ?? "badge badge-gray"}>{s.status}</span></td>
                      <td><span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(s.created_at)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default function DashboardStrategyPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <StrategyContent />
    </Suspense>
  );
}
