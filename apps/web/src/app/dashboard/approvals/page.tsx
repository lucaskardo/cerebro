"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Approval } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Tab = "pending" | "approved" | "rejected";

const STATUS_BADGE: Record<string, string> = {
  pending:  "badge badge-yellow",
  approved: "badge badge-green",
  rejected: "badge badge-red",
  executed: "badge badge-blue",
  expired:  "badge badge-gray",
};

interface Toast { msg: string; type: "success" | "error" | "info"; }

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function ApprovalsContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";

  const [tab, setTab] = useState<Tab>("pending");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (msg: string, type: Toast["type"] = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ status: tab });
      if (siteId) q.set("site_id", siteId);
      const res = await fetch(`${API_URL}/api/approvals?${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      setItems(await res.json());
    } catch (e) {
      showToast(`Failed to load approvals: ${e}`, "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, siteId]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing((s) => new Set(s).add(id));
    try {
      const res = await fetch(`${API_URL}/api/approvals/${id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast(`${action === "approve" ? "Approved" : "Rejected"} successfully`, "success");
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      showToast(`Action failed: ${e}`, "error");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const entityTypes = ["all", ...Array.from(new Set(items.map((i) => i.entity_type)))];
  const filtered = entityFilter === "all" ? items : items.filter((i) => i.entity_type === entityFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div>
        <h1 className="page-title">Approval Queue</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.3rem" }}>
          Review and approve AI-generated actions before they execute
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--dash-border)" }}>
        {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setEntityFilter("all"); }}
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
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>Type:</span>
        {entityTypes.map((et) => (
          <button
            key={et}
            onClick={() => setEntityFilter(et)}
            style={{
              padding: "0.25rem 0.625rem",
              background: entityFilter === et ? "var(--dash-accent-dim)" : "transparent",
              border: `1px solid ${entityFilter === et ? "var(--dash-accent)" : "var(--dash-border)"}`,
              borderRadius: "4px",
              color: entityFilter === et ? "var(--dash-accent)" : "var(--dash-text-dim)",
              fontSize: "0.6875rem",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {et}
          </button>
        ))}
        <button
          onClick={load}
          style={{ marginLeft: "auto", background: "transparent", border: "1px solid var(--dash-border)", borderRadius: "4px", color: "var(--dash-text-dim)", fontSize: "0.6875rem", padding: "0.25rem 0.625rem", cursor: "pointer" }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "2.5rem" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1.25rem" }}>
            <div style={{ fontSize: "2rem", opacity: 0.2, marginBottom: "0.75rem" }}>
              {tab === "pending" ? "⏳" : tab === "approved" ? "✓" : "✗"}
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--dash-text-dim)" }}>
              No {tab} approvals{entityFilter !== "all" ? ` for ${entityFilter}` : ""}.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Entity Type</th>
                  <th>Action</th>
                  <th>Requested By</th>
                  <th>Created</th>
                  <th>Status</th>
                  {tab === "pending" && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const isActing = acting.has(a.id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <span className="badge badge-gray" style={{ textTransform: "none" }}>
                          {a.entity_type}
                        </span>
                      </td>
                      <td style={{ maxWidth: "240px" }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.action}
                        </span>
                        {a.notes && (
                          <span style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)" }}>{a.notes}</span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                        {a.requested_by}
                      </td>
                      <td className="mono" style={{ fontSize: "0.7rem", color: "var(--dash-text-dim)" }}>
                        {fmtDate(a.created_at)}
                      </td>
                      <td>
                        <span className={STATUS_BADGE[a.status] ?? "badge badge-gray"}>{a.status}</span>
                      </td>
                      {tab === "pending" && (
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: "0.375rem", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => act(a.id, "approve")}
                              disabled={isActing}
                              style={{
                                padding: "0.25rem 0.625rem",
                                background: "var(--dash-accent-dim)",
                                border: "1px solid #00d97e33",
                                borderRadius: "4px",
                                color: "var(--dash-accent)",
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                cursor: isActing ? "not-allowed" : "pointer",
                                opacity: isActing ? 0.5 : 1,
                              }}
                            >
                              {isActing ? "…" : "✓ Approve"}
                            </button>
                            <button
                              onClick={() => act(a.id, "reject")}
                              disabled={isActing}
                              style={{
                                padding: "0.25rem 0.625rem",
                                background: "#ff4d4d11",
                                border: "1px solid #ff4d4d33",
                                borderRadius: "4px",
                                color: "var(--dash-danger)",
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                cursor: isActing ? "not-allowed" : "pointer",
                                opacity: isActing ? 0.5 : 1,
                              }}
                            >
                              {isActing ? "…" : "✗ Reject"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <ApprovalsContent />
    </Suspense>
  );
}
