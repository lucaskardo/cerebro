"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentAsset } from "@/lib/api";
import { api } from "@/lib/api";
import ExportCSV from "@/components/dashboard/ExportCSV";

const STATUS_TABS = ["all", "draft", "review", "approved", "generating", "error"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const BADGE_CLASS: Record<string, string> = {
  approved: "badge badge-green", review: "badge badge-yellow",
  draft: "badge badge-gray", generating: "badge badge-blue", error: "badge badge-red",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function ContentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusParam = searchParams.get("status");
  const activeTab: StatusTab = (STATUS_TABS as readonly string[]).includes(statusParam ?? "") ? statusParam as StatusTab : "all";

  const [items, setItems] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.content().then((data) => { setItems(data); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  const counts: Record<string, number> = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  const filtered = activeTab === "all" ? items : items.filter((i) => i.status === activeTab);
  const totalArticles = items.length;
  const approvedCount = counts["approved"] ?? 0;
  const pendingReview = counts["review"] ?? 0;
  const qualityItems = items.filter((i) => i.quality_score != null);
  const avgQuality = qualityItems.length > 0 ? Math.round(qualityItems.reduce((s, i) => s + (i.quality_score ?? 0), 0) / qualityItems.length) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Contenido</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
            {loading ? "…" : `${totalArticles} artículo${totalArticles !== 1 ? "s" : ""} en pipeline`}
          </p>
        </div>
        <ExportCSV data={filtered as unknown as Record<string, unknown>[]} filename="content.csv" label="Export CSV" />
      </div>

      {error && <div style={{ background: "#ff4d4d11", border: "1px solid #ff4d4d33", borderRadius: "8px", padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--dash-danger)" }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const count = tab === "all" ? totalArticles : (counts[tab] ?? 0);
          const isActive = tab === activeTab;
          return (
            <Link key={tab} href={tab === "all" ? "/dashboard/content" : `/dashboard/content?status=${tab}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.3rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none", border: isActive ? "1px solid var(--dash-accent)" : "1px solid var(--dash-border)", background: isActive ? "var(--dash-accent-dim)" : "transparent", color: isActive ? "var(--dash-accent)" : "var(--dash-text-dim)" }}>
              <span style={{ textTransform: "capitalize" }}>{tab === "all" ? "Todos" : tab}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6875rem", opacity: 0.75 }}>{loading ? "…" : count}</span>
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : totalArticles}</div><div className="stat-label">Total artículos</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : approvedCount}</div><div className="stat-label">Aprobados</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : avgQuality != null ? avgQuality : "—"}</div><div className="stat-label">Calidad promedio</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : pendingReview}</div><div className="stat-label">En revisión</div></div>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            {activeTab === "all" ? "No hay artículos todavía." : `No hay artículos con estado "${activeTab}".`}
          </div>
        ) : (
          <table className="dash-table">
            <thead><tr><th>Título</th><th>Keyword</th><th>Estado</th><th>Calidad</th><th>Creado</th></tr></thead>
            <tbody>
              {filtered.map((item) => {
                const title = truncate(item.title.replace("[GENERATING] ", ""), 60);
                const qualColor = item.quality_score == null ? "var(--dash-text-dim)" : item.quality_score >= 80 ? "var(--dash-accent)" : item.quality_score >= 60 ? "#f59e0b" : "#ff4d4d";
                return (
                  <tr key={item.id}>
                    <td style={{ maxWidth: "340px" }}>
                      {item.status === "approved" ? (
                        <Link href={`/content/${item.id}`} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dash-text)", fontWeight: 500, textDecoration: "none" }} title={item.title}>{title}</Link>
                      ) : (
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dash-text)", fontWeight: 500 }} title={item.title}>{title}</span>
                      )}
                    </td>
                    <td><span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{item.keyword}</span></td>
                    <td><span className={BADGE_CLASS[item.status] ?? "badge badge-gray"}>{item.status}</span></td>
                    <td><span className="mono" style={{ fontSize: "0.8125rem", fontWeight: 600, color: qualColor }}>{item.quality_score != null ? `${item.quality_score}/100` : "—"}</span></td>
                    <td><span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{formatDate(item.created_at)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
