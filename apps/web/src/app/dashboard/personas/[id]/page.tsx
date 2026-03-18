"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Persona, PersonaIdentity, SocialQueueItem } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_COLOR: Record<string, string> = {
  active: "badge badge-green",
  inactive: "badge badge-gray",
  suspended: "badge badge-red",
};

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "badge badge-red",
  tiktok: "badge badge-blue",
  x: "badge badge-gray",
  linkedin: "badge badge-blue",
  whatsapp: "badge badge-green",
};

function platformClass(platform: string): string {
  const k = platform.toLowerCase();
  if (k === "reddit") return "badge";
  return PLATFORM_COLOR[k] ?? "badge badge-gray";
}

function platformStyle(platform: string): React.CSSProperties {
  if (platform.toLowerCase() === "reddit")
    return { background: "#ff450018", color: "#ff4500", border: "1px solid #ff450033" };
  return {};
}

export default function PersonaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [identities, setIdentities] = useState<PersonaIdentity[]>([]);
  const [queue, setQueue] = useState<SocialQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      fetch(`${API_URL}/api/personas/${id}`, { headers: authHeaders(), cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(`${r.status}`))),
      api.personaIdentities(id),
      api.socialQueue({ persona_id: id, limit: 20 }),
    ]).then(([pRes, iRes, qRes]) => {
      if (pRes.status === "fulfilled") setPersona(pRes.value);
      else setError(`No se encontró la persona (${pRes.reason})`);
      if (iRes.status === "fulfilled") setIdentities(iRes.value);
      if (qRes.status === "fulfilled") setQueue(qRes.value);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="dash-card skeleton" style={{ height: "6rem" }} />
        ))}
      </div>
    );
  }

  if (error || !persona) {
    return (
      <div className="dash-card" style={{ textAlign: "center", padding: "3rem", color: "var(--dash-text-dim)" }}>
        <p style={{ marginBottom: "1rem" }}>{error ?? "Persona no encontrada."}</p>
        <Link href="/dashboard/personas" className="btn-secondary">← Volver a Personas</Link>
      </div>
    );
  }

  const platforms = Object.keys(persona.platforms ?? {});
  const traits = Object.entries(persona.personality_traits ?? {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/dashboard/personas" style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem", textDecoration: "none" }}>
          ← Personas
        </Link>
        <span style={{ color: "var(--dash-border)" }}>/</span>
        <h1 className="page-title" style={{ margin: 0 }}>{persona.name}</h1>
        <span className={STATUS_COLOR[persona.status] ?? "badge badge-gray"}>{persona.status}</span>
      </div>

      {/* Main info + traits */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 className="section-title">Perfil</h2>
          {persona.age && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Edad</span>
              <span style={{ fontSize: "0.8125rem" }}>{persona.age} años</span>
            </div>
          )}
          {persona.city && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Ciudad</span>
              <span style={{ fontSize: "0.8125rem" }}>{persona.city}</span>
            </div>
          )}
          {platforms.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>Plataformas</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", justifyContent: "flex-end" }}>
                {platforms.map((p) => (
                  <span key={p} className={platformClass(p)} style={platformStyle(p)}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {persona.backstory && (
            <div style={{ marginTop: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginBottom: "0.25rem" }}>Backstory</p>
              <p style={{ fontSize: "0.8125rem", fontStyle: "italic", lineHeight: 1.6, color: "var(--dash-text)" }}>
                {persona.backstory}
              </p>
            </div>
          )}
        </div>

        <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 className="section-title">Rasgos de Personalidad</h2>
          {traits.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>Sin rasgos configurados.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {traits.map(([key, val]) => (
                <span
                  key={key}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    background: "var(--dash-accent-dim)",
                    color: "var(--dash-accent)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 500,
                  }}
                >
                  {val || key}
                </span>
              ))}
            </div>
          )}
          {persona.visual_prompt && (
            <div style={{ marginTop: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginBottom: "0.25rem" }}>Visual Prompt</p>
              <p style={{ fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--dash-text)" }}>{persona.visual_prompt}</p>
            </div>
          )}
        </div>
      </div>

      {/* Identities */}
      <div className="dash-card">
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>
          Identidades ({identities.length})
        </h2>
        {identities.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", textAlign: "center", padding: "1.5rem 0" }}>
            Sin identidades configuradas.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Plataforma</th>
                  <th>Handle / Email</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {identities.map((identity) => (
                  <tr key={identity.id}>
                    <td>
                      <span className={platformClass(identity.platform)} style={platformStyle(identity.platform)}>
                        {identity.platform}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: "0.75rem" }}>{identity.handle_or_email ?? "—"}</td>
                    <td style={{ fontSize: "0.8125rem" }}>{(identity as unknown as Record<string, string>)["display_name"] ?? "—"}</td>
                    <td>
                      <span className={identity.status === "active" ? "badge badge-green" : "badge badge-gray"}>
                        {identity.status ?? "—"}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>
                      {fmtDate(identity.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Social Queue */}
      <div className="dash-card">
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>
          Cola Social ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", textAlign: "center", padding: "1.5rem 0" }}>
            Sin contenido en cola.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Plataforma</th>
                  <th>Tipo</th>
                  <th>Contenido</th>
                  <th>Estado</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={platformClass(item.platform)} style={platformStyle(item.platform)}>
                        {item.platform}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{item.content_type}</td>
                    <td style={{ maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8125rem" }}>
                      {item.content_text ?? "—"}
                    </td>
                    <td>
                      <span className={
                        item.status === "published" ? "badge badge-green" :
                        item.status === "scheduled" ? "badge badge-blue" :
                        item.status === "draft" ? "badge badge-yellow" :
                        "badge badge-red"
                      }>{item.status}</span>
                    </td>
                    <td className="mono" style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>
                      {fmtDate(item.created_at)}
                    </td>
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
