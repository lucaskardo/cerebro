"use client";

import { useState } from "react";
import { captureLead } from "@/lib/api";

interface Props {
  origenUrl?: string;
  temaInteres?: string;
  intentScore?: number;
  calculatorData?: Record<string, unknown>;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  onSuccess?: () => void;
}

export default function EmailCaptureForm({
  origenUrl,
  temaInteres,
  intentScore = 5,
  calculatorData,
  headline = "Recibe la guía completa gratis",
  subheadline = "Te envío por email las mejores opciones para colombianos.",
  ctaText = "Enviar guía →",
  onSuccess,
}: Props) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      await captureLead({
        email: email.trim(),
        nombre: nombre.trim() || undefined,
        origen_url: origenUrl || (typeof window !== "undefined" ? window.location.href : undefined),
        tema_interes: temaInteres,
        intent_score: intentScore,
        calculator_data: calculatorData,
      });
      setDone(true);
      onSuccess?.();
    } catch {
      setError("Hubo un error. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-bold text-green-400 mb-2">¡Listo!</h3>
        <p className="text-slate-400 text-sm">
          Te enviamos la información a <strong className="text-slate-200">{email}</strong>.<br />
          Revisa tu bandeja de entrada (y spam por si acaso).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 md:p-8">
      <h3 className="text-lg font-bold text-slate-100 mb-1">{headline}</h3>
      <p className="text-sm text-slate-400 mb-5">{subheadline}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Tu nombre (opcional)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-colors"
        />
        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-colors"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full bg-green-500 hover:bg-green-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold py-3 px-6 rounded-xl text-sm transition-all"
        >
          {loading ? "Enviando..." : ctaText}
        </button>
      </form>

      <p className="text-xs text-slate-600 mt-3 text-center">
        Sin spam. Solo contenido útil sobre finanzas para colombianos.
      </p>
    </div>
  );
}
