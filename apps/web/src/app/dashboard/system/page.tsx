"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

function authHdrs(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

type Tab = "jobs" | "flags" | "alerts" | "audit";

interface DbFlag {
  id: string;
  site_id: string | null;
  flag_name: string;
  enabled: boolean;
}

interface Job {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Alert {
  id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  action_url: string | null;
  dismissed_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Status {
  budget: { spent: number; limit: number; remaining: number; percent: number; blocked: boolean; warning: boolean };
  features: Record<string, boolean>;
  [key: string]: unknown;
}

interface Toast { msg: string; type: "success" | "error" | "info"; }

const JOB_BADGE: Record<string, string> = {
  queued:        "badge badge-gray",
  running:       "badge badge-blue",
  completed:     "badge badge-green",
  failed:        "badge badge-red",
  dead_lettered: "badge badge-red",
  retrying:      "badge badge-yellow",
};

const ALERT_BADGE: Record<string, string> = {
  info:     "badge badge-blue",
  warning:  "badge badge-yellow",
  critical: "badge badge-red",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function SystemContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";

  const [tab, setTab] = useState<Tab>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobStatus, setJobStatus] = useState<string>("all");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [dbFlags, setDbFlags] = useState<DbFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [sendingBriefing, setSendingBriefing] = useState(false);
  const [previewingBriefing, setPreviewingBriefing] = useState(false);
  const [briefingModal, setBriefingModal] = useState<{ subject: string; html: string } | null>(null);

  const showToast = (msg: string, type: Toast["type"] = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "50" });
      if (jobStatus !== "all") q.set("status", jobStatus);
      if (siteId) q.set("site_id", siteId);
      const res = await fetch(`${API_URL}/api/tasks?${q}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setJobs(await res.json());
    } catch (e) {
      showToast(`Failed to load jobs: ${e}`, "error");
    } finally {
      setLoading(false);
    }
  }, [jobStatus, siteId]);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/alerts`);
      if (!res.ok) throw new Error(`${res.status}`);
      setAlerts(await res.json());
    } catch (e) {
      showToast(`Failed to load alerts: ${e}`, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (siteId) q.set("site_id", siteId);
      const res = await fetch(`${API_URL}/api/flags${q.toString() ? `?${q}` : ""}`, { headers: authHdrs() });
      if (!res.ok) throw new Error(`${res.status}`);
      setDbFlags(await res.json());
    } catch (e) {
      showToast(`Failed to load flags: ${e}`, "error");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/audit?limit=100`, { headers: authHdrs() });
      if (!res.ok) throw new Error(`${res.status}`);
      setAudit(await res.json());
    } catch (e) {
      showToast(`Failed to load audit log: ${e}`, "error");
      setAudit([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    if (tab === "jobs") loadJobs();
    if (tab === "flags") loadFlags();
    if (tab === "alerts") loadAlerts();
    if (tab === "audit") loadAudit();
  }, [tab, loadJobs, loadFlags, loadAlerts, loadAudit, loadStatus]);

  const retryJob = async (id: string) => {
    setRetrying((s) => new Set(s).add(id));
    try {
      const res = await fetch(`${API_URL}/api/tasks/${id}/run`, { method: "POST", headers: authHdrs() });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast("Job queued for retry", "success");
      loadJobs();
    } catch (e) {
      showToast(`Retry failed: ${e}`, "error");
    } finally {
      setRetrying((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const dismissAlert = async (id: string) => {
    setDismissing((s) => new Set(s).add(id));
    try {
      const res = await fetch(`${API_URL}/api/alerts/${id}/dismiss`, { method: "POST", headers: authHdrs() });
      if (!res.ok) throw new Error(`${res.status}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      showToast("Alert dismissed", "success");
    } catch (e) {
      showToast(`Dismiss failed: ${e}`, "error");
    } finally {
      setDismissing((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const toggleFlag = async (flagId: string, flagName: string, current: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/flags/${flagId}`, {
        method: "PATCH",
        headers: authHdrs(),
        body: JSON.stringify({ enabled: !current }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast(`${flagName} ${!current ? "enabled" : "disabled"}`, "success");
      loadFlags();
    } catch (e) {
      showToast(`Toggle failed: ${e}`, "error");
    }
  };

  const sendTestBriefing = async () => {
    if (!siteId) { showToast("Selecciona un site en el selector de marca (sidebar izquierdo)", "error"); return; }
    setSendingBriefing(true);
    try {
      const res = await fetch(`${API_URL}/api/briefing/generate`, {
        method: "POST",
        headers: authHdrs(),
        body: JSON.stringify({ site_id: siteId }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast("Briefing enviado al email configurado ✓", "success");
    } catch (e) {
      showToast(`Error enviando briefing: ${e}`, "error");
    } finally {
      setSendingBriefing(false);
    }
  };

  const previewBriefing = async () => {
    if (!siteId) { showToast("Selecciona un site en el selector de marca (sidebar izquierdo)", "error"); return; }
    setPreviewingBriefing(true);
    try {
      const res = await fetch(`${API_URL}/api/briefing/preview`, {
        method: "POST",
        headers: authHdrs(),
        body: JSON.stringify({ site_id: siteId }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setBriefingModal({ subject: data.subject, html: data.body_html });
    } catch (e) {
      showToast(`Error generando preview: ${e}`, "error");
    } finally {
      setPreviewingBriefing(false);
    }
  };

  const filteredAudit = auditSearch
    ? audit.filter((e) =>
        e.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        e.actor.toLowerCase().includes(auditSearch.toLowerCase()) ||
        e.resource_type.toLowerCase().includes(auditSearch.toLowerCase())
      )
    : audit;

  const features = status?.features ?? {};
  const budget = status?.budget;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Briefing preview modal */}
      {briefingModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setBriefingModal(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "640px", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Preview — Daily Briefing</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>{briefingModal.subject}</div>
              </div>
              <button onClick={() => setBriefingModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "#64748b", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              <iframe
                srcDoc={briefingModal.html}
                style={{ width: "100%", height: "600px", border: "none" }}
                title="Briefing preview"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="page-title">Sistema</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.3rem" }}>
          Jobs, feature flags, alerts, and audit log
        </p>
      </div>

      {/* Budget health bar */}
      {budget && (
        <div className="dash-card" style={{ padding: "0.875rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Daily Budget</span>
            <span className="mono" style={{ fontSize: "0.8125rem", color: budget.warning ? "var(--dash-warn)" : budget.blocked ? "var(--dash-danger)" : "var(--dash-accent)" }}>
              ${budget.spent.toFixed(2)} / ${budget.limit.toFixed(2)}
            </span>
          </div>
          <div style={{ height: "6px", background: "var(--dash-border)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(budget.percent, 100)}%`,
              background: budget.blocked ? "var(--dash-danger)" : budget.warning ? "var(--dash-warn)" : "var(--dash-accent)",
              borderRadius: "3px",
              transition: "width 0.3s",
            }} />
          </div>
          {budget.warning && !budget.blocked && (
            <p style={{ fontSize: "0.7rem", color: "var(--dash-warn)", marginTop: "0.35rem" }}>⚠ Under 20% remaining</p>
          )}
          {budget.blocked && (
            <p style={{ fontSize: "0.7rem", color: "var(--dash-danger)", marginTop: "0.35rem" }}>✗ Budget exceeded — LLM calls blocked</p>
          )}
        </div>
      )}

      {/* Daily Briefing */}
      <div className="dash-card" style={{ padding: "0.875rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--dash-text)" }}>Daily Briefing</div>
            <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "2px" }}>
              {siteId ? "Resumen de actividad para el site seleccionado" : "Selecciona un site en el sidebar para enviar"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
            <button
              onClick={previewBriefing}
              disabled={previewingBriefing || !siteId}
              style={{
                padding: "0.5rem 0.875rem", borderRadius: "7px", fontSize: "0.8125rem",
                fontWeight: 600, border: "1px solid var(--dash-border)",
                background: "transparent", color: "var(--dash-text-dim)",
                cursor: (previewingBriefing || !siteId) ? "not-allowed" : "pointer",
                opacity: !siteId ? 0.4 : previewingBriefing ? 0.6 : 1, whiteSpace: "nowrap",
              }}
            >
              {previewingBriefing ? "Generando…" : "Preview"}
            </button>
            <button
              onClick={sendTestBriefing}
              disabled={sendingBriefing || !siteId}
              style={{
                padding: "0.5rem 1.125rem", borderRadius: "7px", fontSize: "0.8125rem",
                fontWeight: 600, border: "1px solid var(--dash-accent)",
                background: "var(--dash-accent-dim)", color: "var(--dash-accent)",
                cursor: (sendingBriefing || !siteId) ? "not-allowed" : "pointer",
                opacity: !siteId ? 0.4 : sendingBriefing ? 0.6 : 1, whiteSpace: "nowrap",
              }}
            >
              {sendingBriefing ? "Enviando…" : "Send Test Briefing"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--dash-border)" }}>
        {(["jobs", "flags", "alerts", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--dash-accent)" : "2px solid transparent",
              color: tab === t ? "var(--dash-accent)" : "var(--dash-text-dim)",
              fontSize: "0.8125rem",
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
              textTransform: "capitalize",
              marginBottom: "-1px",
            }}
          >
            {t === "flags" ? "Feature Flags" : t === "audit" ? "Audit Log" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Jobs tab ─────────────────────────────────────────────── */}
      {tab === "jobs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>Status:</span>
            {["all", "queued", "running", "completed", "failed", "dead_lettered"].map((s) => (
              <button
                key={s}
                onClick={() => setJobStatus(s)}
                style={{
                  padding: "0.25rem 0.625rem",
                  background: jobStatus === s ? "var(--dash-accent-dim)" : "transparent",
                  border: `1px solid ${jobStatus === s ? "var(--dash-accent)" : "var(--dash-border)"}`,
                  borderRadius: "4px",
                  color: jobStatus === s ? "var(--dash-accent)" : "var(--dash-text-dim)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.05em",
                }}
              >
                {s}
              </button>
            ))}
            <button onClick={loadJobs} style={{ marginLeft: "auto", background: "transparent", border: "1px solid var(--dash-border)", borderRadius: "4px", color: "var(--dash-text-dim)", fontSize: "0.6875rem", padding: "0.25rem 0.625rem", cursor: "pointer" }}>
              ↻ Refresh
            </button>
          </div>

          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "2rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
                No jobs found for filter: {jobStatus}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Attempts</th>
                      <th>Created</th>
                      <th>Completed</th>
                      <th>Error</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} style={{ borderLeft: j.status === "running" ? "2px solid var(--dash-accent)" : "2px solid transparent" }}>
                        <td className="mono" style={{ fontSize: "0.75rem" }}>{j.job_type}</td>
                        <td><span className={JOB_BADGE[j.status] ?? "badge badge-gray"}>{j.status}</span></td>
                        <td className="mono" style={{ textAlign: "right", color: j.attempts > 1 ? "var(--dash-warn)" : undefined }}>{j.attempts}</td>
                        <td className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)" }}>{fmtDate(j.created_at)}</td>
                        <td className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)" }}>{fmtDate(j.completed_at)}</td>
                        <td style={{ maxWidth: "180px" }}>
                          {j.error ? (
                            <span style={{ fontSize: "0.7rem", color: "var(--dash-danger)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.error}>
                              {j.error}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {(j.status === "failed" || j.status === "dead_lettered") && (
                            <button
                              onClick={() => retryJob(j.id)}
                              disabled={retrying.has(j.id)}
                              style={{
                                padding: "0.2rem 0.5rem",
                                background: "var(--dash-accent-dim)",
                                border: "1px solid #00d97e33",
                                borderRadius: "4px",
                                color: "var(--dash-accent)",
                                fontSize: "0.6875rem",
                                cursor: retrying.has(j.id) ? "not-allowed" : "pointer",
                                opacity: retrying.has(j.id) ? 0.5 : 1,
                              }}
                            >
                              {retrying.has(j.id) ? "…" : "↺ Retry"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Feature Flags tab ────────────────────────────────────── */}
      {tab === "flags" && (
        <div className="dash-card">
          <h2 className="section-title" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>Feature Flags</h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
            </div>
          ) : dbFlags.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>
              No feature flags found.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {dbFlags.map((flag) => (
                <div
                  key={flag.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.625rem 0.875rem",
                    background: "var(--dash-bg)",
                    borderRadius: "6px",
                    border: "1px solid var(--dash-border)",
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: "0.8125rem", color: "var(--dash-text)" }}>{flag.flag_name}</div>
                    {flag.site_id && <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", marginTop: "0.1rem" }}>{flag.site_id.slice(0, 8)}…</div>}
                  </div>
                  <button
                    onClick={() => toggleFlag(flag.id, flag.flag_name, flag.enabled)}
                    style={{
                      padding: "0.3rem 0.875rem",
                      background: flag.enabled ? "var(--dash-accent-dim)" : "var(--dash-border)",
                      border: `1px solid ${flag.enabled ? "var(--dash-accent)" : "var(--dash-border-hi)"}`,
                      borderRadius: "20px",
                      color: flag.enabled ? "var(--dash-accent)" : "var(--dash-text-dim)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      minWidth: "72px",
                      textAlign: "center",
                    }}
                  >
                    {flag.enabled ? "ON" : "OFF"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Alerts tab ───────────────────────────────────────────── */}
      {tab === "alerts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={loadAlerts} style={{ background: "transparent", border: "1px solid var(--dash-border)", borderRadius: "4px", color: "var(--dash-text-dim)", fontSize: "0.6875rem", padding: "0.25rem 0.625rem", cursor: "pointer" }}>
              ↻ Refresh
            </button>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: "4rem" }} />)}
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
              <div style={{ fontSize: "2rem", opacity: 0.2, marginBottom: "0.5rem" }}>✓</div>
              No active alerts.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {alerts.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: "0.875rem 1rem",
                    background: "var(--dash-surface)",
                    border: `1px solid ${a.severity === "critical" ? "#ff4d4d33" : a.severity === "warning" ? "#f59e0b33" : "var(--dash-border)"}`,
                    borderLeft: `3px solid ${a.severity === "critical" ? "var(--dash-danger)" : a.severity === "warning" ? "var(--dash-warn)" : "#38bdf8"}`,
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <span className={ALERT_BADGE[a.severity] ?? "badge badge-gray"}>{a.severity}</span>
                      <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{a.alert_type}</span>
                    </div>
                    <p style={{ fontSize: "0.8125rem", color: "var(--dash-text)", margin: 0 }}>{a.message}</p>
                    <p style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>{fmtDate(a.created_at)}</p>
                  </div>
                  <button
                    onClick={() => dismissAlert(a.id)}
                    disabled={dismissing.has(a.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--dash-border)",
                      borderRadius: "4px",
                      color: "var(--dash-text-dim)",
                      fontSize: "0.6875rem",
                      padding: "0.25rem 0.5rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {dismissing.has(a.id) ? "…" : "Dismiss"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Log tab ────────────────────────────────────────── */}
      {tab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search actions, actors, resource types…"
              style={{
                flex: 1,
                padding: "0.4rem 0.75rem",
                background: "var(--dash-bg)",
                border: "1px solid var(--dash-border)",
                borderRadius: "6px",
                color: "var(--dash-text)",
                fontSize: "0.8125rem",
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
              }}
            />
            <button onClick={loadAudit} style={{ background: "transparent", border: "1px solid var(--dash-border)", borderRadius: "4px", color: "var(--dash-text-dim)", fontSize: "0.6875rem", padding: "0.4rem 0.625rem", cursor: "pointer" }}>
              ↻
            </button>
          </div>

          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "2rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.25rem" }} />)}
              </div>
            ) : filteredAudit.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
                {auditSearch ? "No entries match search." : "No audit entries found."}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Resource</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((e) => (
                      <tr key={e.id}>
                        <td className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)", whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</td>
                        <td className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-accent)" }}>{e.actor}</td>
                        <td style={{ fontSize: "0.8125rem" }}>{e.action}</td>
                        <td className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)" }}>
                          {e.resource_type}{e.resource_id ? ` · ${e.resource_id.slice(0, 8)}…` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <SystemContent />
    </Suspense>
  );
}
