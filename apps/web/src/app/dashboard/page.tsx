"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, reviewContent, type Lead, type Approval, type ContentAsset } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";
function authHdrs(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

interface CycleRun {
  id: string; status: string;
  opportunities_generated: number; experiments_created: number;
  tasks_auto_run: number; tasks_queued_approval: number;
  kill_reason: string | null; error: string | null;
  created_at: string; completed_at: string | null;
}

const CYCLE_BADGE: Record<string, string> = {
  completed: "badge badge-green", running: "badge badge-blue",
  paused: "badge badge-yellow", failed: "badge badge-red",
};

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
function isToday(iso: string) {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function KPICard({ label, value, sub, href, accent = "green" }: {
  label: string; value: string | number; sub?: string; href?: string;
  accent?: "green" | "yellow" | "red" | "blue" | "dim";
}) {
  const color = accent === "green" ? "var(--dash-accent)" : accent === "yellow" ? "var(--dash-warn)" :
    accent === "red" ? "var(--dash-danger)" : accent === "blue" ? "#38bdf8" : "var(--dash-text-dim)";
  const card = (
    <div className="dash-card" style={{ cursor: href ? "pointer" : "default" }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)", marginTop: "0.25rem", fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{card}</Link> : card;
}

function SkeletonCard() {
  return <div className="dash-card"><div className="skeleton" style={{ height: "2rem", width: "60%", marginBottom: "0.5rem" }} /><div className="skeleton" style={{ height: "0.75rem", width: "80%" }} /></div>;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviewItems, setReviewItems] = useState<ContentAsset[]>([]);
  const [approvedItems, setApprovedItems] = useState<ContentAsset[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [cycles, setCycles] = useState<CycleRun[]>([]);
  const [activeExperiments, setActiveExperiments] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [briefingPreview, setBriefingPreview] = useState<{ subject: string; body_text: string } | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  useEffect(() => {
    setLoading(true);
    const sid = siteId || undefined;
    Promise.allSettled([
      api.leads(sid),
      api.content("review", sid),
      api.content("approved", sid),
      api.approvals("pending", sid),
      api.cycleHistory(5),
      api.experiments(sid ? { site_id: sid } : undefined),
    ]).then(([l, rev, app, appr, cyc, exp]) => {
      if (l.status === "fulfilled") setLeads(l.value);
      if (rev.status === "fulfilled") setReviewItems(rev.value);
      if (app.status === "fulfilled") setApprovedItems(app.value);
      if (appr.status === "fulfilled") setPendingApprovals(appr.value.slice(0, 5));
      if (cyc.status === "fulfilled") setCycles(cyc.value as unknown as CycleRun[]);
      if (exp.status === "fulfilled") {
        const expArr = exp.value;
        setActiveExperiments(expArr.filter((e) => e.status === "running").length);
      }
      setLoading(false);
    });
  }, [siteId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadBriefingPreview() {
    if (!siteId) return;
    setLoadingBriefing(true);
    try {
      const res = await fetch(`${API_URL}/api/briefing/preview`, {
        method: "POST",
        headers: authHdrs(),
        body: JSON.stringify({ site_id: siteId }),
      });
      if (res.ok) {
        const data = await res.json();
        setBriefingPreview({ subject: data.subject, body_text: data.body_text });
      }
    } catch { /* non-fatal */ } finally {
      setLoadingBriefing(false);
    }
  }

  async function approveInline(item: ContentAsset) {
    setApproving((prev) => ({ ...prev, [item.id]: true }));
    try {
      await reviewContent(item.id, "approve");
      setReviewItems((prev) => prev.filter((i) => i.id !== item.id));
      setApprovedItems((prev) => [{ ...item, status: "approved" }, ...prev]);
      showToast(`✓ "${truncate(item.title, 40)}" aprobado`);
    } catch {
      showToast(`✗ Error al aprobar`);
    } finally {
      setApproving((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  const leadsToday = leads.filter((l) => isToday(l.created_at)).length;
  const recentLeads = [...leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const siteSuffix = siteId ? `?site_id=${siteId}` : "";

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div><div className="skeleton" style={{ height: "2rem", width: "260px", marginBottom: "0.5rem" }} /><div className="skeleton" style={{ height: "1rem", width: "300px" }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.875rem" }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
          <SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 200,
          padding: "0.625rem 1rem", borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 500,
          background: toast.startsWith("✓") ? "var(--dash-accent)" : "var(--dash-danger)",
          color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Business Health</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.3rem" }}>
            {siteId ? "Métricas del sitio seleccionado" : "Visión general de todos los sitios"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href={`/dashboard/content${siteSuffix}`} className="btn-primary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>+ Generar contenido</Link>
          {pendingApprovals.length > 0 && (
            <Link href={`/dashboard/approvals${siteSuffix}`} className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>
              Aprobar pendientes ({pendingApprovals.length})
            </Link>
          )}
          <Link href={`/dashboard/leads${siteSuffix}`} className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>Ver leads</Link>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.875rem" }}>
        <KPICard
          label="Leads hoy"
          value={fmt(leadsToday)}
          sub={`${fmt(leads.length)} total`}
          href={`/dashboard/leads${siteSuffix}`}
          accent={leadsToday > 0 ? "green" : "dim"}
        />
        <KPICard
          label="En revisión"
          value={fmt(reviewItems.length)}
          sub="pendientes de aprobar"
          href={`/dashboard/content?status=review${siteId ? `&site_id=${siteId}` : ""}`}
          accent={reviewItems.length > 0 ? "yellow" : "dim"}
        />
        <KPICard
          label="Publicados"
          value={fmt(approvedItems.length)}
          sub="artículos aprobados"
          href={`/dashboard/content?status=approved${siteId ? `&site_id=${siteId}` : ""}`}
          accent="green"
        />
        <KPICard
          label="Experiments activos"
          value={fmt(activeExperiments)}
          href={`/dashboard/experiments${siteSuffix}`}
          accent={activeExperiments > 0 ? "blue" : "dim"}
        />
      </div>

      {/* Review queue + Recent leads */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>

        {/* Articles pending review */}
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 className="section-title" style={{ fontSize: "0.875rem" }}>
              Pendientes de revisión
              {reviewItems.length > 0 && (
                <span style={{ marginLeft: "0.5rem", background: "var(--dash-warn)", color: "#fff", fontSize: "0.625rem", fontWeight: 700, padding: "0.1rem 0.35rem", borderRadius: "8px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {reviewItems.length}
                </span>
              )}
            </h2>
            <Link href={`/dashboard/content?status=review${siteId ? `&site_id=${siteId}` : ""}`} style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>Todos →</Link>
          </div>
          {reviewItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <div style={{ fontSize: "1.5rem", opacity: 0.3, marginBottom: "0.5rem" }}>✓</div>
              <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>Sin artículos pendientes.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {reviewItems.slice(0, 5).map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.625rem", background: "var(--dash-bg)", borderRadius: "6px", border: "1px solid var(--dash-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--dash-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                      {truncate(item.title, 45)}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.keyword} · {item.quality_score != null ? `${item.quality_score}/100` : "sin score"}
                    </div>
                  </div>
                  <button
                    disabled={approving[item.id]}
                    onClick={() => approveInline(item)}
                    style={{
                      padding: "0.25rem 0.625rem", borderRadius: "6px", fontSize: "0.6875rem",
                      fontWeight: 600, border: "1px solid var(--dash-accent)",
                      background: "var(--dash-accent-dim)", color: "var(--dash-accent)",
                      cursor: approving[item.id] ? "not-allowed" : "pointer",
                      flexShrink: 0, opacity: approving[item.id] ? 0.6 : 1,
                    }}
                  >
                    {approving[item.id] ? "…" : "Aprobar"}
                  </button>
                </div>
              ))}
              {reviewItems.length > 5 && (
                <Link href={`/dashboard/content?status=review${siteId ? `&site_id=${siteId}` : ""}`} className="btn-secondary" style={{ textAlign: "center", fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>
                  Ver {reviewItems.length - 5} más →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Recent leads */}
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Últimos leads</h2>
            <Link href={`/dashboard/leads${siteSuffix}`} style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>Todos →</Link>
          </div>
          {recentLeads.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <div style={{ fontSize: "1.5rem", opacity: 0.3, marginBottom: "0.5rem" }}>◎</div>
              <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>Sin leads todavía.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {recentLeads.map((lead) => (
                <div key={lead.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.5rem 0.625rem", background: "var(--dash-bg)", borderRadius: "6px", border: "1px solid var(--dash-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dash-text)" }}>
                      {lead.email}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>
                      {lead.utm_source || "directo"} · {lead.tema_interes ? truncate(lead.tema_interes, 28) : "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
                    <span className={lead.intent_score >= 7 ? "badge badge-green" : lead.intent_score >= 4 ? "badge badge-yellow" : "badge badge-gray"} style={{ fontSize: "0.6875rem" }}>
                      {lead.intent_score}/10
                    </span>
                    <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{fmtDateShort(lead.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Briefing preview */}
      {siteId && (
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Daily Briefing</h2>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                onClick={loadBriefingPreview}
                disabled={loadingBriefing}
                style={{
                  background: "transparent", border: "1px solid var(--dash-border)", borderRadius: "4px",
                  color: "var(--dash-text-dim)", fontSize: "0.6875rem", padding: "0.25rem 0.625rem",
                  cursor: loadingBriefing ? "not-allowed" : "pointer", opacity: loadingBriefing ? 0.6 : 1,
                }}
              >
                {loadingBriefing ? "Generando…" : "Ver preview"}
              </button>
              <Link href="/dashboard/system" style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>Enviar →</Link>
            </div>
          </div>
          {briefingPreview ? (
            <div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--dash-text)", marginBottom: "0.75rem" }}>
                {briefingPreview.subject}
              </div>
              <pre style={{
                fontSize: "0.75rem", color: "var(--dash-text-dim)", lineHeight: 1.6,
                whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0,
                background: "var(--dash-bg)", padding: "0.75rem", borderRadius: "6px",
                border: "1px solid var(--dash-border)", maxHeight: "200px", overflowY: "auto",
              }}>
                {briefingPreview.body_text}
              </pre>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "1rem 0", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
              Haz click en "Ver preview" para generar el resumen de hoy
            </div>
          )}
        </div>
      )}

      {/* Recent cycles */}
      <div className="dash-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Ciclos recientes</h2>
          <Link href="/dashboard/intelligence" style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>Intelligence →</Link>
        </div>
        {cycles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            No hay ciclos. <span className="mono" style={{ fontSize: "0.75rem" }}>POST /api/loop/run</span> para iniciar.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Iniciado</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Opps</th>
                  <th style={{ textAlign: "right" }}>Experiments</th>
                  <th style={{ textAlign: "right" }}>Auto-Run</th>
                  <th style={{ textAlign: "right" }}>En cola</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)" }}>{fmtDate(c.created_at)}</td>
                    <td><span className={CYCLE_BADGE[c.status] ?? "badge badge-gray"}>{c.status}</span></td>
                    <td className="mono" style={{ textAlign: "right" }}>{c.opportunities_generated}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{c.experiments_created}</td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--dash-accent)" }}>{c.tasks_auto_run}</td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--dash-warn)" }}>{c.tasks_queued_approval}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <DashboardContent />
    </Suspense>
  );
}
