"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CycleRun {
  id: string;
  status: string;
  opportunities_generated: number;
  experiments_created: number;
  tasks_auto_run: number;
  tasks_queued_approval: number;
  kill_reason: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface KnowledgeInsight {
  id: string;
  category: string;
  insight: string;
  confidence: number | string;
  evidence?: Record<string, unknown>;
  created_at: string;
}

interface LoopStatus {
  scheduler_enabled?: boolean;
  last_cycle?: {
    id?: string;
    status?: string;
    completed_at?: string | null;
    created_at?: string | null;
  } | null;
  running?: boolean;
}

interface BusinessHealthExtended {
  leads_today?: number;
  leads_this_week?: number;
  last_cycle_at?: string | null;
  last_cycle_status?: string | null;
  [key: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CYCLE_STATUS_BADGE: Record<string, string> = {
  completed: "badge badge-green",
  running:   "badge badge-blue",
  paused:    "badge badge-yellow",
  failed:    "badge badge-red",
};

const CATEGORY_BADGE: Record<string, string> = {
  content:    "badge badge-blue",
  channel:    "badge badge-green",
  audience:   "badge badge-yellow",
  conversion: "badge badge-green",
};

function parseConfidence(raw: number | string | undefined): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === "number") return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  const n = parseFloat(String(raw));
  return isNaN(n) ? 0 : n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="dash-card">
      <div className="stat-value" style={accent ? undefined : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function IntelligenceContent() {
  const searchParams = useSearchParams();
  // siteId available for future filtering
  void searchParams.get("site_id");

  const [health, setHealth] = useState<BusinessHealthExtended | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeInsight[]>([]);
  const [cycles, setCycles] = useState<CycleRun[]>([]);
  const [loop, setLoop] = useState<LoopStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.businessHealth(),
      api.knowledgeInsights(15),
      api.cycleHistory(20),
      api.loopStatus(),
    ]).then(([hRes, kRes, cRes, lRes]) => {
      if (hRes.status === "fulfilled") setHealth(hRes.value as unknown as BusinessHealthExtended);
      if (kRes.status === "fulfilled" && Array.isArray(kRes.value)) {
        const sorted = [...(kRes.value as unknown as KnowledgeInsight[])].sort(
          (a, b) => parseConfidence(b.confidence) - parseConfidence(a.confidence)
        );
        setKnowledge(sorted);
      }
      if (cRes.status === "fulfilled" && Array.isArray(cRes.value)) {
        setCycles(cRes.value as unknown as CycleRun[]);
      }
      if (lRes.status === "fulfilled") setLoop(lRes.value as unknown as LoopStatus);
      setLoading(false);
    });
  }, []);

  const schedulerEnabled = loop?.scheduler_enabled ?? false;
  const lastCycle = loop?.last_cycle ?? null;
  const topConfidence = knowledge.length > 0 ? parseConfidence(knowledge[0].confidence) : null;
  const experimentsEvaluated = cycles.reduce((sum, c) => sum + (c.experiments_created ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">Intelligence</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
          Sistema de aprendizaje continuo
        </p>
      </div>

      {/* Loop status banner */}
      <div style={{
        padding: "0.875rem 1.25rem",
        borderRadius: "0.875rem",
        border: "1px solid",
        borderColor: schedulerEnabled ? "rgba(0, 217, 126, 0.3)" : "var(--dash-border)",
        background: schedulerEnabled ? "rgba(0, 217, 126, 0.06)" : "rgba(100, 116, 139, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap" as const,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{
            width: "0.625rem",
            height: "0.625rem",
            borderRadius: "50%",
            background: schedulerEnabled ? "var(--dash-accent)" : "#64748b",
            display: "inline-block",
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: schedulerEnabled ? "var(--dash-accent)" : "#64748b" }}>
            {loading ? "…" : schedulerEnabled ? "Loop activo" : "Loop pausado"}
          </span>
        </div>
        {lastCycle && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
            {lastCycle.status && (
              <span className={CYCLE_STATUS_BADGE[lastCycle.status] ?? "badge badge-gray"}>{lastCycle.status}</span>
            )}
            {lastCycle.completed_at && <span>Último ciclo: {fmtDate(lastCycle.completed_at)}</span>}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <Stat label="Knowledge entries" value={loading ? "…" : knowledge.length} />
        <Stat label="Último ciclo" value={loading ? "…" : health?.last_cycle_at ? fmtDate(health.last_cycle_at as string) : lastCycle?.completed_at ? fmtDate(lastCycle.completed_at) : "—"} />
        <Stat label="Experimentos evaluados" value={loading ? "…" : experimentsEvaluated} />
        <Stat label="Top confidence" value={loading ? "…" : topConfidence !== null ? `${topConfidence}%` : "—"} accent={topConfidence !== null && topConfidence >= 70} />
      </div>

      {/* Knowledge insights */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="section-title">Lo que el sistema ha aprendido</h2>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.875rem" }}>
            {[...Array(4)].map((_, i) => <div key={i} className="dash-card skeleton" style={{ height: "7rem" }} />)}
          </div>
        ) : knowledge.length === 0 ? (
          <div className="dash-card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--dash-text-dim)" }}>
            <p style={{ fontSize: "0.875rem" }}>Sin insights todavía</p>
            <p className="mono" style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--dash-muted)" }}>
              Los insights aparecen tras evaluar experimentos
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.875rem" }}>
            {knowledge.map((k) => {
              const conf = parseConfidence(k.confidence);
              const evidenceCount = k.evidence ? Object.keys(k.evidence).length : 0;
              return (
                <div key={k.id} className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className={CATEGORY_BADGE[k.category] ?? "badge badge-gray"}>{k.category}</span>
                    <span className="mono" style={{ fontSize: "0.75rem", fontWeight: 600, color: conf >= 70 ? "var(--dash-accent)" : conf >= 40 ? "#f59e0b" : "var(--dash-text-dim)" }}>
                      {conf}%
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.5, margin: 0 }}>{k.insight}</p>
                  {evidenceCount > 0 && (
                    <p style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{evidenceCount} evidencia{evidenceCount !== 1 ? "s" : ""}</p>
                  )}
                  <div style={{ height: 3, borderRadius: 2, background: "var(--dash-border)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(conf, 100)}%`,
                      borderRadius: 2,
                      background: conf >= 70 ? "var(--dash-accent)" : conf >= 40 ? "#f59e0b" : "#64748b",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Cycle history */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="section-title">
          Ciclos recientes
          {!loading && cycles.length > 0 && (
            <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--dash-text-dim)", marginLeft: "0.5rem" }}>· {cycles.length} ciclos</span>
          )}
        </h2>
        {loading ? (
          <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.25rem" }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
          </div>
        ) : cycles.length === 0 ? (
          <div className="dash-card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--dash-text-dim)" }}>
            <p style={{ fontSize: "0.875rem" }}>Sin ciclos todavía</p>
            <p className="mono" style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--dash-muted)" }}>
              POST /api/loop/run para iniciar el primer ciclo
            </p>
          </div>
        ) : (
          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Iniciado</th><th>Estado</th>
                    <th style={{ textAlign: "right" }}>Opps</th>
                    <th style={{ textAlign: "right" }}>Experiments</th>
                    <th style={{ textAlign: "right" }}>Auto-run</th>
                    <th style={{ textAlign: "right" }}>En cola</th>
                    <th>Kill reason</th>
                    <th style={{ textAlign: "right" }}>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id}>
                      <td><span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(c.created_at)}</span></td>
                      <td><span className={CYCLE_STATUS_BADGE[c.status] ?? "badge badge-gray"}>{c.status}</span></td>
                      <td style={{ textAlign: "right" }}><span className="mono">{c.opportunities_generated}</span></td>
                      <td style={{ textAlign: "right" }}><span className="mono">{c.experiments_created}</span></td>
                      <td style={{ textAlign: "right" }}><span className="mono" style={{ color: "var(--dash-accent)" }}>{c.tasks_auto_run}</span></td>
                      <td style={{ textAlign: "right" }}><span className="mono" style={{ color: "#f59e0b" }}>{c.tasks_queued_approval}</span></td>
                      <td style={{ maxWidth: 200 }}>
                        {c.kill_reason ? (
                          <span style={{ color: "var(--dash-danger)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{c.kill_reason}</span>
                        ) : (
                          <span style={{ color: "var(--dash-text-dim)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}><span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{formatDuration(c.created_at, c.completed_at)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
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
