"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentAsset, Site } from "@/lib/api";
import { api, reviewContent } from "@/lib/api";
import ExportCSV from "@/components/dashboard/ExportCSV";

const STATUS_TABS = ["all", "draft", "review", "approved", "generating", "error"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const BADGE_CLASS: Record<string, string> = {
  approved: "badge badge-green",
  review: "badge badge-yellow",
  draft: "badge badge-gray",
  generating: "badge badge-blue",
  error: "badge badge-red",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function scoreColor(score: number | null) {
  if (score == null) return "var(--dash-text-dim)";
  if (score >= 80) return "var(--dash-accent)";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = scoreColor(value);
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{label}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
      </div>
      <div style={{ height: "5px", background: "var(--dash-border)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${v}%`, background: color, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function ScoreDetail({ item, onClose }: { item: ContentAsset; onClose: () => void }) {
  const total = item.score_humanity != null
    ? Math.round((item.score_humanity * 0.25) + ((item.score_specificity ?? 0) * 0.25) + ((item.score_structure ?? 0) * 0.2) + ((item.score_seo ?? 0) * 0.2) + ((item.score_readability ?? 0) * 0.1))
    : null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--dash-card)", border: "1px solid var(--dash-border)", borderRadius: "12px",
        padding: "1.5rem", width: "100%", maxWidth: "420px", boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--dash-text)", marginBottom: "2px" }}>
              {truncate(item.title, 50)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>Score de calidad IA</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dash-text-dim)", fontSize: "1.25rem", lineHeight: 1 }}>×</button>
        </div>

        {total != null ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "2.5rem", fontWeight: 800, color: scoreColor(total), fontFamily: "'JetBrains Mono', monospace" }}>{total}</span>
              <span style={{ fontSize: "1rem", color: "var(--dash-text-dim)" }}>/100</span>
            </div>
            <ScoreBar label="Humanidad" value={item.score_humanity} />
            <ScoreBar label="Especificidad" value={item.score_specificity} />
            <ScoreBar label="Estructura" value={item.score_structure} />
            <ScoreBar label="SEO" value={item.score_seo} />
            <ScoreBar label="Legibilidad" value={item.score_readability} />
            {item.score_feedback && (
              <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--dash-bg)", borderRadius: "8px", border: "1px solid var(--dash-border)" }}>
                <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Feedback</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.6 }}>{item.score_feedback}</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem", padding: "1rem 0" }}>
            Score no disponible — artículos nuevos se evalúan automáticamente durante generación.
          </div>
        )}
      </div>
    </div>
  );
}

interface Toast { id: number; msg: string; ok: boolean; }

function ContentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteId = searchParams.get("site_id") || "";
  const statusParam = searchParams.get("status");
  const activeTab: StatusTab = (STATUS_TABS as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as StatusTab)
    : "all";

  const [items, setItems] = useState<ContentAsset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});
  const [scoreDetail, setScoreDetail] = useState<ContentAsset | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.content(undefined, siteId || undefined),
      api.sites(),
    ]).then(([c, s]) => {
      if (c.status === "fulfilled") setItems(c.value);
      else setError(String((c as PromiseRejectedResult).reason));
      if (s.status === "fulfilled") setSites(s.value);
      setLoading(false);
    });
  }, [siteId]);

  function addToast(msg: string, ok: boolean) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  async function handleReview(item: ContentAsset, action: "approve" | "reject") {
    setActioning((prev) => ({ ...prev, [item.id]: true }));
    try {
      await reviewContent(item.id, action);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: action === "approve" ? "approved" : "draft" }
            : i
        )
      );
      addToast(
        action === "approve"
          ? `"${truncate(item.title, 40)}" aprobado`
          : `"${truncate(item.title, 40)}" rechazado`,
        action === "approve"
      );
    } catch {
      addToast(`Error al ${action === "approve" ? "aprobar" : "rechazar"}`, false);
    } finally {
      setActioning((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  const siteMap = Object.fromEntries(sites.map((s) => [s.id, s.brand_name || s.domain]));

  const counts: Record<string, number> = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  const filtered = activeTab === "all" ? items : items.filter((i) => i.status === activeTab);
  const totalArticles = items.length;
  const approvedCount = counts["approved"] ?? 0;
  const pendingReview = counts["review"] ?? 0;
  const qualityItems = items.filter((i) => i.quality_score != null);
  const avgQuality =
    qualityItems.length > 0
      ? Math.round(qualityItems.reduce((s, i) => s + (i.quality_score ?? 0), 0) / qualityItems.length)
      : null;

  function tabHref(tab: string) {
    const p = new URLSearchParams();
    if (tab !== "all") p.set("status", tab);
    if (siteId) p.set("site_id", siteId);
    return `/dashboard/content${p.toString() ? `?${p}` : ""}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {scoreDetail && <ScoreDetail item={scoreDetail} onClose={() => setScoreDetail(null)} />}

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 200, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {toasts.map((t) => (
            <div key={t.id} style={{
              padding: "0.625rem 1rem",
              borderRadius: "8px",
              fontSize: "0.8125rem",
              fontWeight: 500,
              background: t.ok ? "var(--dash-accent)" : "var(--dash-danger)",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              animation: "fadeIn 0.15s ease",
            }}>
              {t.ok ? "✓ " : "✗ "}{t.msg}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Contenido</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
            {loading ? "…" : `${totalArticles} artículo${totalArticles !== 1 ? "s" : ""} en pipeline`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <ExportCSV data={filtered as unknown as Record<string, unknown>[]} filename="content.csv" label="Export CSV" />
        </div>
      </div>

      {error && (
        <div style={{ background: "#ff4d4d11", border: "1px solid #ff4d4d33", borderRadius: "8px", padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--dash-danger)" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const count = tab === "all" ? totalArticles : (counts[tab] ?? 0);
          const isActive = tab === activeTab;
          return (
            <Link
              key={tab}
              href={tabHref(tab)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                padding: "0.3rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem",
                fontWeight: 600, textDecoration: "none",
                border: isActive ? "1px solid var(--dash-accent)" : "1px solid var(--dash-border)",
                background: isActive ? "var(--dash-accent-dim)" : "transparent",
                color: isActive ? "var(--dash-accent)" : "var(--dash-text-dim)",
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{tab === "all" ? "Todos" : tab}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6875rem", opacity: 0.75 }}>
                {loading ? "…" : count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : totalArticles}</div><div className="stat-label">Total artículos</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : approvedCount}</div><div className="stat-label">Aprobados</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : avgQuality != null ? avgQuality : "—"}</div><div className="stat-label">Calidad promedio</div></div>
        <div className="dash-card"><div className="stat-value" style={{ color: pendingReview > 0 ? "var(--dash-warn)" : undefined }}>{loading ? "…" : pendingReview}</div><div className="stat-label">En revisión</div></div>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            {activeTab === "all"
              ? <>No hay artículos todavía. <Link href="/dashboard/system" style={{ color: "var(--dash-accent)" }}>Genera uno →</Link></>
              : `No hay artículos con estado "${activeTab}".`}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Brand</th>
                  <th>Keyword</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Calidad</th>
                  <th style={{ textAlign: "right" }}>AI Score</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const title = truncate((item.title ?? "").replace("[GENERATING] ", ""), 55);
                  const qualColor =
                    item.quality_score == null
                      ? "var(--dash-text-dim)"
                      : item.quality_score >= 80
                      ? "var(--dash-accent)"
                      : item.quality_score >= 60
                      ? "#f59e0b"
                      : "#ff4d4d";
                  const brandName = item.site_id ? (siteMap[item.site_id] ?? item.site_id.slice(0, 8) + "…") : "—";
                  const isLoading = actioning[item.id];

                  // Compute AI total from 5 dimensions
                  const aiTotal = item.score_humanity != null
                    ? Math.round((item.score_humanity * 0.25) + ((item.score_specificity ?? 0) * 0.25) + ((item.score_structure ?? 0) * 0.2) + ((item.score_seo ?? 0) * 0.2) + ((item.score_readability ?? 0) * 0.1))
                    : null;

                  return (
                    <tr key={item.id}>
                      <td style={{ maxWidth: "280px", minWidth: 0 }}>
                        <span
                          style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dash-text)", fontWeight: 500 }}
                          title={item.title}
                        >
                          {title}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ fontSize: "0.6875rem" }}>{brandName}</span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{item.keyword ?? "—"}</span>
                      </td>
                      <td>
                        <span className={BADGE_CLASS[item.status] ?? "badge badge-gray"}>{item.status}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="mono" style={{ fontSize: "0.8125rem", fontWeight: 600, color: qualColor }}>
                          {item.quality_score != null ? `${item.quality_score}/100` : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {aiTotal != null ? (
                          <button
                            onClick={() => setScoreDetail(item)}
                            style={{
                              background: "none", border: "none", cursor: "pointer", padding: 0,
                              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem", fontWeight: 700,
                              color: scoreColor(aiTotal),
                            }}
                            title="Ver desglose de score"
                          >
                            {aiTotal} ↗
                          </button>
                        ) : (
                          <span style={{ color: "var(--dash-text-dim)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{formatDate(item.created_at)}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                          {item.status === "review" && (
                            <>
                              <button
                                disabled={isLoading}
                                onClick={() => handleReview(item, "approve")}
                                style={{
                                  padding: "0.25rem 0.625rem", borderRadius: "6px", fontSize: "0.75rem",
                                  fontWeight: 600, border: "1px solid var(--dash-accent)",
                                  background: "var(--dash-accent-dim)", color: "var(--dash-accent)",
                                  cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1,
                                }}
                              >
                                {isLoading ? "…" : "Aprobar"}
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={() => handleReview(item, "reject")}
                                style={{
                                  padding: "0.25rem 0.625rem", borderRadius: "6px", fontSize: "0.75rem",
                                  fontWeight: 600, border: "1px solid var(--dash-border)",
                                  background: "transparent", color: "var(--dash-text-dim)",
                                  cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1,
                                }}
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {item.status === "approved" && (
                            <Link
                              href={`/articulo/${item.slug}`}
                              target="_blank"
                              style={{ padding: "0.25rem 0.625rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, border: "1px solid var(--dash-border)", color: "var(--dash-text-dim)", textDecoration: "none" }}
                            >
                              Ver →
                            </Link>
                          )}
                        </div>
                      </td>
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

export default function DashboardContentPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <ContentPageContent />
    </Suspense>
  );
}
