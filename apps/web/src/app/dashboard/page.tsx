import Link from "next/link";
import { api, type BusinessHealth, type Status, type Approval, type ContentAsset } from "@/lib/api";

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

interface LoopStatus {
  scheduler_enabled?: boolean;
  last_cycle_at?: string | null;
  last_cycle_status?: string | null;
  [key: string]: unknown;
}

function fmt(n: number) { return n.toLocaleString(); }
function fmtCurrency(n: number) { return `$${n.toFixed(2)}`; }
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

const CYCLE_BADGE: Record<string, string> = {
  completed: "badge badge-green",
  running:   "badge badge-blue",
  paused:    "badge badge-yellow",
  failed:    "badge badge-red",
};
const APPROVAL_BADGE: Record<string, string> = {
  pending:  "badge badge-yellow",
  approved: "badge badge-green",
  rejected: "badge badge-red",
  executed: "badge badge-blue",
  expired:  "badge badge-gray",
};

function KPICard({
  label,
  value,
  sub,
  href,
  accent = "green",
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  accent?: "green" | "yellow" | "red" | "blue" | "dim";
}) {
  const color =
    accent === "green" ? "var(--dash-accent)" :
    accent === "yellow" ? "var(--dash-warn)" :
    accent === "red" ? "var(--dash-danger)" :
    accent === "blue" ? "#38bdf8" :
    "var(--dash-text-dim)";

  const card = (
    <div className="dash-card" style={{ cursor: href ? "pointer" : "default", transition: "border-color 0.12s" }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)", marginTop: "0.25rem", fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{card}</Link> : card;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site_id?: string }>;
}) {
  const { site_id } = await searchParams;

  const [healthResult, statusResult, cyclesResult, loopResult, approvalsResult, contentResult] =
    await Promise.allSettled([
      api.businessHealth(),
      api.status(),
      api.cycleHistory(5),
      api.loopStatus(),
      api.approvals("pending", site_id),
      api.content("approved"),
    ]);

  const health: BusinessHealth | null =
    healthResult.status === "fulfilled" ? healthResult.value : null;
  const status: Status | null =
    statusResult.status === "fulfilled" ? statusResult.value : null;
  const cycles: CycleRun[] =
    cyclesResult.status === "fulfilled" ? (cyclesResult.value as unknown as CycleRun[]) : [];
  const loop: LoopStatus | null =
    loopResult.status === "fulfilled" ? (loopResult.value as LoopStatus) : null;
  const pendingApprovals: Approval[] =
    approvalsResult.status === "fulfilled" ? approvalsResult.value.slice(0, 5) : [];
  const topContent: ContentAsset[] =
    contentResult.status === "fulfilled" ? contentResult.value.slice(0, 5) : [];

  const leadsToday      = health?.leads_today             ?? status?.leads_today ?? 0;
  const leadsWeek       = health?.leads_this_week          ?? 0;
  const costToday       = health?.cost_today               ?? status?.budget?.spent ?? 0;
  const budgetRemaining = health?.budget_remaining         ?? status?.budget?.remaining ?? 0;
  const articlesWeek    = health?.articles_published_week  ?? 0;
  const errorRate       = health?.error_rate_24h            ?? 0;
  const budgetWarning   = health?.budget_warning            ?? status?.budget?.warning ?? false;
  const schedulerEnabled = loop?.scheduler_enabled ?? false;
  const lastCycleAt     = loop?.last_cycle_at ?? null;
  const lastCycleStatus = loop?.last_cycle_status ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Business Health</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.3rem" }}>
            Real-time demand generation overview
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <a
            href="/api/loop/run"
            onClick={(e) => { e.preventDefault(); }}
            className="btn-primary"
            style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}
          >
            ▶ Run Cycle Now
          </a>
          <Link
            href="/dashboard/experiments"
            className="btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}
          >
            + New Experiment
          </Link>
        </div>
      </div>

      {/* KPI cards — 3 cols on wide, 2 on medium */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.875rem" }}>
        <KPICard label="Leads Today"        value={fmt(leadsToday)}              href="/dashboard/leads"       accent="green" />
        <KPICard label="Leads This Week"     value={fmt(leadsWeek)}               href="/dashboard/leads"       accent="green" />
        <KPICard label="Cost Today"          value={fmtCurrency(costToday)}       href="/dashboard/system"      accent={budgetWarning ? "yellow" : "green"} />
        <KPICard label="Budget Remaining"    value={fmtCurrency(budgetRemaining)} href="/dashboard/system"      accent={budgetRemaining < 5 ? "red" : "green"} />
        <KPICard label="Articles This Week"  value={fmt(articlesWeek)}            href="/dashboard/content"     accent="green" />
        <KPICard label="Error Rate 24h"      value={`${errorRate}%`}              href="/dashboard/system"      accent={errorRate > 20 ? "red" : errorRate > 5 ? "yellow" : "green"} />
      </div>

      {/* Middle row: Loop status + Trend placeholder */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "0.875rem" }}>
        {/* Loop status */}
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Strategy Loop</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Scheduler</span>
              <span className={schedulerEnabled ? "badge badge-green" : "badge badge-gray"}>{schedulerEnabled ? "on" : "off"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Last Cycle</span>
              {lastCycleStatus ? (
                <span className={CYCLE_BADGE[lastCycleStatus] ?? "badge badge-gray"}>{lastCycleStatus}</span>
              ) : (
                <span className="badge badge-gray">none</span>
              )}
            </div>
            <div>
              <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Last Run</span>
              <p className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text)", marginTop: "0.15rem" }}>{fmtDate(lastCycleAt as string | null)}</p>
            </div>
          </div>
          <Link href="/dashboard/intelligence" className="btn-secondary" style={{ alignSelf: "flex-start", marginTop: "auto", fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}>
            Intelligence →
          </Link>
        </div>

        {/* Trend chart placeholder */}
        <div className="dash-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2 className="section-title" style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}>Lead Trend — 30 days</h2>
          <div style={{
            flex: 1,
            minHeight: "120px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--dash-bg)",
            borderRadius: "6px",
            border: "1px dashed var(--dash-border)",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", opacity: 0.3 }}>📈</div>
              <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "0.4rem" }}>
                Chart integration — connect to attribution events
              </div>
              <Link href="/dashboard/attribution" style={{ fontSize: "0.7rem", color: "var(--dash-accent)", marginTop: "0.5rem", display: "block" }}>
                View Attribution →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Top assets + Pending approvals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
        {/* Top content assets */}
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Top Assets</h2>
            <Link href="/dashboard/content" style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>All →</Link>
          </div>
          {topContent.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", padding: "1rem 0" }}>No published content yet.</p>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th style={{ textAlign: "right" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((a) => (
                  <tr key={a.id}>
                    <td style={{ maxWidth: "200px" }}>
                      <Link href={`/dashboard/content/${a.id}`} style={{ color: "var(--dash-text)", textDecoration: "none" }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.title}
                        </span>
                      </Link>
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--dash-accent)" }}>
                      {a.quality_score != null ? a.quality_score : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending approvals preview */}
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <h2 className="section-title" style={{ fontSize: "0.875rem" }}>
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <span style={{
                  marginLeft: "0.5rem",
                  background: "var(--dash-danger)",
                  color: "#fff",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  padding: "0.1rem 0.35rem",
                  borderRadius: "8px",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
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
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    padding: "0.5rem 0.625rem",
                    background: "var(--dash-bg)",
                    borderRadius: "6px",
                    border: "1px solid var(--dash-border)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--dash-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.action}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>
                      {a.entity_type} · {fmtDate(a.created_at)}
                    </div>
                  </div>
                  <span className={APPROVAL_BADGE[a.status] ?? "badge badge-gray"}>{a.status}</span>
                </div>
              ))}
              <Link href="/dashboard/approvals" className="btn-primary" style={{ textAlign: "center", marginTop: "0.25rem", fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}>
                Review All Approvals →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent cycles table */}
      <div className="dash-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="section-title" style={{ fontSize: "0.875rem" }}>Recent Cycles</h2>
          <Link href="/dashboard/intelligence" style={{ fontSize: "0.7rem", color: "var(--dash-accent)" }}>All →</Link>
        </div>
        {cycles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            No cycles recorded yet.{" "}
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-muted)" }}>POST /api/loop/run</span>{" "}
            to start.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Opps</th>
                  <th style={{ textAlign: "right" }}>Experiments</th>
                  <th style={{ textAlign: "right" }}>Auto-Run</th>
                  <th style={{ textAlign: "right" }}>Queued</th>
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
