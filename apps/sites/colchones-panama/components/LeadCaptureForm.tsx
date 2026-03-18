"use client";
import { useState, useEffect } from "react";
import { captureLead } from "@/lib/api";

interface Props {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaVariant?: string;
  assetId?: string;
  showName?: boolean;
  dark?: boolean;
}

function getFingerprint(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("cp_vid") || "";
}

function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = p.get(k);
    if (v) result[k] = v;
  }
  return result;
}

export default function LeadCaptureForm({
  headline = "Recibe consejos de sueño cada semana",
  subheadline = "Guías imparciales y comparativas actualizadas, directamente en tu email.",
  ctaText = "Suscribirme gratis →",
  ctaVariant = "inline",
  assetId,
  showName = false,
  dark = false,
}: Props) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [origenUrl, setOrigenUrl] = useState("");

  useEffect(() => {
    setOrigenUrl(window.location.href);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    const utm = getUtmParams();
    const result = await captureLead({
      email,
      nombre: nombre || undefined,
      asset_id: assetId,
      cta_variant: ctaVariant,
      origen_url: origenUrl,
      ...utm,
      metadata: { fingerprint: getFingerprint() },
    });
    setStatus(result.ok ? "success" : "error");
  };

  const base = dark
    ? "bg-primary-700 text-text-dark border-primary-600"
    : "bg-accent-50 text-text-light border-accent-200";

  if (status === "success") {
    return (
      <div className={`rounded-2xl border p-8 text-center ${base}`}>
        <div className="text-4xl mb-3">✓</div>
        <h3 className="text-xl font-bold font-serif mb-2">¡Listo! Ya estás suscrito.</h3>
        <p className="text-sm opacity-75">Revisa tu email — te enviaremos contenido exclusivo pronto.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-8 ${base}`} id="email-capture">
      <h3 className="text-2xl font-bold font-serif mb-2">{headline}</h3>
      <p className="text-sm opacity-75 mb-6">{subheadline}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {showName && (
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="px-4 py-3 rounded-xl border border-accent-200 bg-white text-text-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 dark:bg-card-dark dark:border-primary-600 dark:text-text-dark"
          />
        )}
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="email"
            placeholder="tu@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-accent-200 bg-white text-text-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 dark:bg-card-dark dark:border-primary-600 dark:text-text-dark"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-6 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {status === "loading" ? "Enviando…" : ctaText}
          </button>
        </div>
        {status === "error" && (
          <p className="text-red-500 text-xs">Hubo un error. Intenta de nuevo.</p>
        )}
        <p className="text-xs opacity-50">Sin spam. Puedes darte de baja cuando quieras.</p>
      </form>
    </div>
  );
}
