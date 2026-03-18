import Link from "next/link";
import type { ContentAsset } from "@/lib/api";
import ExportCSV from "@/components/dashboard/ExportCSV";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";

const headers = { "x-api-key": process.env.API_SECRET_KEY || "" };

const STATUS_TABS = ["all", "draft", "review", "approved", "generating", "error"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const BADGE_CLASS: Record<string, string> = {
  approved:   "badge badge-green",
  review:     "badge badge-yellow",
  draft:      "badge badge-gray",
  generating: "badge badge-blue",
  error:      "badge badge-red",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export default async function DashboardContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeTab: StatusTab =
    STATUS_TABS.includes(statusParam as StatusTab) ? (statusParam as StatusTab) : "all";

  let items: ContentAsset[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${API_URL}/api/content`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    items = await res.json();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando contenido";
  }

  // Count by status
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }

  // Filter by active tab
  const filtered =
    activeTab === "all" ? items : items.filter((i) => i.status === activeTab);

  // Stats
  const totalArticles = items.length;
  const approvedCount = counts["approved"] ?? 0;
  const pendingReview = counts["review"] ?? 0;
  const qualityItems = items.filter((i) => i.quality_score != null);
  const avgQuality =
    qualityItems.length > 0
      ? Math.round(
          qualityItems.reduce((s, i) => s + (i.quality_score ?? 0), 0) /
            qualityItems.length
        )
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Contenido</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
            {totalArticles} artículo{totalArticles !== 1 ? "s" : ""} en pipeline
          </p>
        </div>
        <ExportCSV
          data={filtered as unknown as Record<string, unknown>[]}
          filename="content.csv"
          label="Export CSV"
        />
      </div>

      {error && (
        <div
          style={{
            background: "#ff4d4d11",
            border: "1px solid #ff4d4d33",
            borderRadius: "8px",
            padding: "0.875rem 1rem",
            fontSize: "0.8125rem",
            color: "var(--dash-danger)",
          }}
        >
          {error}
        </div>
      )}

      {/* Status tabs */}
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const count = tab === "all" ? totalArticles : (counts[tab] ?? 0);
          const isActive = tab === activeTab;
          return (
            <Link
              key={tab}
              href={tab === "all" ? "/dashboard/content" : `/dashboard/content?status=${tab}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.3rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                textDecoration: "none",
                border: isActive
                  ? "1px solid var(--dash-accent)"
                  : "1px solid var(--dash-border)",
                background: isActive ? "var(--dash-accent-dim)" : "transparent",
                color: isActive ? "var(--dash-accent)" : "var(--dash-text-dim)",
                transition: "all 0.12s",
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{tab === "all" ? "Todos" : tab}</span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6875rem",
                  opacity: 0.75,
                }}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <div className="dash-card">
          <div className="stat-value">{totalArticles}</div>
          <div className="stat-label">Total artículos</div>
        </div>
        <div className="dash-card">
          <div className="stat-value">{approvedCount}</div>
          <div className="stat-label">Aprobados</div>
        </div>
        <div className="dash-card">
          <div className="stat-value">
            {avgQuality != null ? `${avgQuality}` : "—"}
          </div>
          <div className="stat-label">Calidad promedio</div>
        </div>
        <div className="dash-card">
          <div className="stat-value">{pendingReview}</div>
          <div className="stat-label">En revisión</div>
        </div>
      </div>

      {/* Content table */}
      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "3rem 1.5rem",
              textAlign: "center",
              color: "var(--dash-text-dim)",
              fontSize: "0.8125rem",
            }}
          >
            {activeTab === "all"
              ? "No hay artículos todavía."
              : `No hay artículos con estado "${activeTab}".`}
          </div>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Keyword</th>
                <th>Estado</th>
                <th>Calidad</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isApproved = item.status === "approved";
                const row = (
                  <>
                    <td style={{ maxWidth: "340px" }}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--dash-text)",
                          fontWeight: 500,
                        }}
                        title={item.title}
                      >
                        {truncate(item.title.replace("[GENERATING] ", ""), 60)}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                        {item.keyword}
                      </span>
                    </td>
                    <td>
                      <span className={BADGE_CLASS[item.status] ?? "badge badge-gray"}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color:
                            item.quality_score == null
                              ? "var(--dash-text-dim)"
                              : item.quality_score >= 80
                              ? "var(--dash-accent)"
                              : item.quality_score >= 60
                              ? "#f59e0b"
                              : "#ff4d4d",
                        }}
                      >
                        {item.quality_score != null ? `${item.quality_score}/100` : "—"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                        {formatDate(item.created_at)}
                      </span>
                    </td>
                  </>
                );

                return isApproved ? (
                  <tr key={item.id} style={{ cursor: "pointer" }}>
                    {/* Wrap entire row content in a Link via td trick */}
                    <td style={{ maxWidth: "340px", padding: 0 }}>
                      <Link
                        href={`/content/${item.id}`}
                        style={{
                          display: "block",
                          padding: "0.625rem 0.75rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--dash-text)",
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                        title={item.title}
                      >
                        {truncate(item.title.replace("[GENERATING] ", ""), 60)}
                      </Link>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                        {item.keyword}
                      </span>
                    </td>
                    <td>
                      <span className={BADGE_CLASS[item.status] ?? "badge badge-gray"}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color:
                            item.quality_score == null
                              ? "var(--dash-text-dim)"
                              : item.quality_score >= 80
                              ? "var(--dash-accent)"
                              : item.quality_score >= 60
                              ? "#f59e0b"
                              : "#ff4d4d",
                        }}
                      >
                        {item.quality_score != null ? `${item.quality_score}/100` : "—"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                        {formatDate(item.created_at)}
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>{row}</tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
