"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type React from "react";
import type { Persona, SocialQueueItem } from "@/lib/api";
import { api } from "@/lib/api";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string | null | undefined, len: number): string {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<Persona["status"], string> = {
  active:    "badge badge-green",
  inactive:  "badge badge-gray",
  suspended: "badge badge-red",
};

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "badge badge-red",
  tiktok:    "badge badge-blue",
  x:         "badge badge-gray",
  linkedin:  "badge badge-blue",
  whatsapp:  "badge badge-green",
};

const QUEUE_STATUS_BADGE: Record<SocialQueueItem["status"], string> = {
  draft:     "badge badge-yellow",
  scheduled: "badge badge-blue",
  published: "badge badge-green",
  failed:    "badge badge-red",
  rejected:  "badge badge-red",
};

function platformBadgeClass(platform: string): string {
  const key = platform.toLowerCase();
  if (key === "reddit") return "badge";
  return PLATFORM_COLOR[key] ?? "badge badge-gray";
}

function platformBadgeStyle(platform: string): React.CSSProperties {
  if (platform.toLowerCase() === "reddit") {
    return { background: "#ff450018", color: "#ff4500", border: "1px solid #ff450033" };
  }
  return {};
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PersonaCard({ persona }: { persona: Persona }) {
  const platforms = Object.keys(persona.platforms ?? {});
  const traits = Object.entries(persona.personality_traits ?? {}).slice(0, 3);
  const subtitle = [persona.age ? `${persona.age} años` : null, persona.city ?? null].filter(Boolean).join(" · ");

  return (
    <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.9375rem", color: "var(--dash-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {persona.name}
          </p>
          {subtitle && <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginTop: "0.15rem" }}>{subtitle}</p>}
        </div>
        <span className={STATUS_BADGE[persona.status]}>{persona.status}</span>
      </div>

      {persona.backstory && (
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", fontStyle: "italic", lineHeight: 1.5, margin: 0 }}>
          {truncate(persona.backstory, 80)}
        </p>
      )}

      {platforms.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {platforms.map((p) => (
            <span key={p} className={platformBadgeClass(p)} style={platformBadgeStyle(p)}>{p}</span>
          ))}
        </div>
      )}

      {traits.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {traits.map(([key, val]) => (
            <span key={key} style={{ fontSize: "0.6875rem", padding: "0.175rem 0.45rem", borderRadius: "4px", background: "var(--dash-accent-dim)", color: "var(--dash-accent)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
              {val || key}
            </span>
          ))}
        </div>
      )}

      <Link href={`/dashboard/personas/${persona.id}`} className="btn-secondary" style={{ alignSelf: "flex-start", marginTop: "auto", fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
        Ver detalle →
      </Link>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function PersonasContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [queue, setQueue] = useState<SocialQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.personas(siteId || undefined),
      api.socialQueue({ status: "draft", limit: 10 }),
    ]).then(([pRes, qRes]) => {
      if (pRes.status === "fulfilled") setPersonas(pRes.value);
      if (qRes.status === "fulfilled") setQueue(qRes.value);
      setLoading(false);
    });
  }, [siteId]);

  const activeCount = personas.filter((p) => p.status === "active").length;
  const platformSet = new Set(personas.flatMap((p) => Object.keys(p.platforms ?? {})));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h1 className="page-title">Personas</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.3rem" }}>Identidades digitales</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : personas.length}</div><div className="stat-label">Total Personas</div></div>
        <div className="dash-card"><div className="stat-value" style={{ color: activeCount > 0 ? "var(--dash-accent)" : "var(--dash-text-dim)" }}>{loading ? "…" : activeCount}</div><div className="stat-label">Activas</div></div>
        <div className="dash-card"><div className="stat-value" style={{ color: queue.length > 0 ? "#f59e0b" : "var(--dash-text-dim)" }}>{loading ? "…" : queue.length}</div><div className="stat-label">Borradores Sociales</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : platformSet.size}</div><div className="stat-label">Plataformas Config.</div></div>
      </div>

      {/* Personas grid */}
      <div>
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>Identidades</h2>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.875rem" }}>
            {[...Array(3)].map((_, i) => <div key={i} className="dash-card skeleton" style={{ height: "10rem" }} />)}
          </div>
        ) : personas.length === 0 ? (
          <div className="dash-card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            No hay personas configuradas. Crea una via la API.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.875rem" }}>
            {personas.map((persona) => <PersonaCard key={persona.id} persona={persona} />)}
          </div>
        )}
      </div>

      {/* Social Queue */}
      <div className="dash-card">
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>Cola de contenido social (borradores)</h2>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
          </div>
        ) : queue.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            No hay borradores pendientes en la cola.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr><th>Plataforma</th><th>Tipo</th><th>Contenido</th><th>Persona</th><th>Estado</th><th>Creado</th></tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id}>
                    <td><span className={platformBadgeClass(item.platform)} style={platformBadgeStyle(item.platform)}>{item.platform}</span></td>
                    <td style={{ color: "var(--dash-text-dim)", fontSize: "0.75rem" }}>{item.content_type}</td>
                    <td style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8125rem", color: "var(--dash-text)" }}>
                      {truncate(item.content_text, 60)}
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>{item.personas?.name ?? "—"}</td>
                    <td><span className={QUEUE_STATUS_BADGE[item.status] ?? "badge badge-gray"}>{item.status}</span></td>
                    <td className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{fmtDate(item.created_at)}</td>
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

export default function PersonasPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <PersonasContent />
    </Suspense>
  );
}
