"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type BusinessHealth, type Status, type Approval, type ContentAsset } from "@/lib/api";

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
const APPROVAL_BADGE: Record<string, string> = {
  pending: "badge badge-yellow", approved: "badge badge-green",
  rejected: "badge badge-red", executed: "badge badge-blue", expired: "badge badge-gray",
};

function fmt(n: number) { return n.toLocaleString(); }
function fmtCurrency(n: number) { return `$${n.toFixed(2)}`; }
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
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

  const [health, setHealth] = useState<BusinessHealth | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [cycles, setCycles] = useState<CycleRun[]>([]);
  const [loop, setLoop] = useState<Record<string, unknown> | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [topContent, setTopContent] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.businessHealth(),
      api.status(),
      api.cycleHistory(5),
      api.loopStatus(),
      api.approvals("pending", siteId || undefined),
      api.content("approved"),
    ]).then(([h, s, c, l, a, ct]) => {
      if (h.status === "fulfilled") setHealth(h.value);
      if (s.status === "fulfilled") setStatus(s.value);
      if (c.status === "fulfilled") setCycles(c.value as unknown as CycleRun[]);
      if (l.status === "fulfilled") setLoop(l.value as Record<string, unknown>);
      if (a.status === "fulfilled") setPendingApprovals(a.value.slice(0, 5));
      if (ct.status === "fulfilled") setTopContent(ct.value.slice(0, 5));
      setLoading(false);
    });
  }, [siteId]);

  const leadsToday     = health?.leads_today            ?? status?.leads_today ?? 0;
  const leadsWeek      = health?.leads_this_week         ?? 0;
  const costToday      = health?.cost_today              ?? status?.budget?.spent ?? 0;
  const budgetRemaining = health?.budget_remaining       ?? status?.budget?.remaining ?? 0;
  const articlesWeek   = health?.articles_published_week ?? 0;
  const errorRate      = health?.error_rate_24h           ?? 0;
  const budgetWarning  = health?.budget_warning           ?? status?.budget?.warning ?? false;
  const schedulerEnabled = (loop?.scheduler_enabled as boolean) ?? false;
  const lastCycleAt    = (loop?.last_cycle_at as string | null) ?? null;
  const lastCycleStatus = (loop?.last_cycle_status as string | null) ?? null;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div><div className="skeleton" style={{ height: "2rem", width: "260px", marginBottom: "0.5rem" }} /><div className="skeleton" style={{ height: "1rem", width: "300px" }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.875rem" }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "0.875rem" }}>
          <SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Business Health</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.3rem" }}>Real-time demand generation overview</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/dashboard/intelligence" className="btn-primary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>▶ Run Cycle Now</Link>
          <Link href="/dashboard/experiments" className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>+ New Experiment</Link>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.875rem" }}>
        <KPICard label="Leads Today"       value={fmt(leadsToday)}              href="/dashboard/leads"   accent="green" />
        <KPICard label="Leads This Week"   value={fmt(leadsWeek)}               href="/dashboard/leads"   accent="green" />
        <KPICard label="Cost Today"        value={fmtCurrency(costToday)}       href="/dashboard/system"  accent={budgetWarning ? "yellow" : "green"} />
        <KPICard label="Budget Remaining"  value={fmtCurrency(budgetRemaining)} href="/dashboard/system"  accent={budgetRemaining < 5 ? "red" : "green"} />
        <KPICard label="Articles / Week"   value={fmt(articlesWeek)}            href="/dashboard/content" accent="green" />
        <KPICard label="Error Rate 24h"    value={`${errorRate}%`}              href="/dashboard/system"  accent={errorRate > 20 ? "red" : errorRate > 5 ? "yellow" : "green"} />
      </div>

      {/* Loop status + trend placeholder */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "0.875rem" }}>
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Strategy Loop</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Scheduler</span>
              <span className={schedulerEnabled ? "badge badge-green" : "badge badge-gray"}>{schedulerEnabled ? "on" : "off"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Last Cycle</span>
              {lastCycleStatus ? <span className={CYCLE_BADGE[lastCycleStatus] ?? "badge badge-gray"}>{lastCycleStatus}</span> : <span className="badge badge-gray">none</span>}
            </div>
            <div>
              <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Last Run</span>
              <p className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text)", marginTop: "0.15rem" }}>{fmtDate(lastCycleAt)}</p>
            </div>
          </div>
          <Link href="/dashboard/intelligence" className="btn-secondary" style={{ alignSelf: "flex-start", marginTop: "auto", fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}>Intelligence →</Link>
        </div>
        <div className="dash-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2 className="section-title" style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}>Lead Trend — 30 days</h2>
          <div style={{ flex: 1, minHeight: "120px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--dash-bg)", borderRadius: "6px", border: "1px dashed var(--dash-border)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", opacity: 0.3 }}>📈</div>
              <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "0.4rem" }}>Chart integration — connect to attribution events</div>
              <Link href="/dashboard/attribution" style={{ fontSize: "0.7rem", color: "var(--dash-accent)", marginTop: "0.5rem", display: "block" }}>View Attribution →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Top assets + Pending approvals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Top Assets</h2>
            <Link href="/dashboard/content" style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>All →</Link>
          </div>
          {topContent.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", padding: "1rem 0" }}>No published content yet.</p>
          ) : (
            <table className="dash-table">
              <thead><tr><th>Title</th><th style={{ textAlign: "right" }}>Score</th></tr></thead>
              <tbody>
                {topContent.map((a) => (
                  <tr key={a.id}>
                    <td style={{ maxWidth: "200px" }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dash-text)" }}>{a.title}</span>
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--dash-accent)" }}>{a.quality_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 className="section-title" style={{ fontSize: "0.875rem" }}>
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <span style={{ marginLeft: "0.5rem", background: "var(--dash-danger)", color: "#fff", fontSize: "0.625rem", fontWeight: 700, padding: "0.1rem 0.35rem", borderRadius: "8px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {pendingApprovals.length}
                </span>
              )}
            </h2>
            <Link href="/dashboard/approvals" style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>All →</Link>
          </div>
          {pendingApprovals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <div style={{ fontSize: "1.5rem", opacity: 0.3, marginBottom: "0.5rem" }}>✓</div>
              <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>All caught up!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {pendingApprovals.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.5rem 0.625rem", background: "var(--dash-bg)", borderRadius: "6px", border: "1px solid var(--dash-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--dash-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.action}</div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{a.entity_type} · {fmtDate(a.created_at)}</div>
                  </div>
                  <span className={APPROVAL_BADGE[a.status] ?? "badge badge-gray"}>{a.status}</span>
                </div>
              ))}
              <Link href="/dashboard/approvals" className="btn-primary" style={{ textAlign: "center", marginTop: "0.25rem", fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>Review All →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent cycles */}
      <div className="dash-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Recent Cycles</h2>
          <Link href="/dashboard/intelligence" style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>All →</Link>
        </div>
        {cycles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            No cycles yet. <span className="mono" style={{ fontSize: "0.75rem" }}>POST /api/loop/run</span> to start.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead><tr><th>Started</th><th>Status</th><th style={{ textAlign: "right" }}>Opps</th><th style={{ textAlign: "right" }}>Experiments</th><th style={{ textAlign: "right" }}>Auto-Run</th><th style={{ textAlign: "right" }}>Queued</th></tr></thead>
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
