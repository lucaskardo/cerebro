"use client";

import { useState } from "react";
import EmailCaptureForm from "@/components/EmailCaptureForm";

// Fee rates by method (total cost % including exchange rate spread)
const METODOS = [
  { id: "western_union", label: "Western Union", fee: 0.072, color: "#f59e0b" },
  { id: "moneygram", label: "MoneyGram", fee: 0.068, color: "#f59e0b" },
  { id: "bancario", label: "Transferencia bancaria", fee: 0.055, color: "#f97316" },
  { id: "efecty", label: "Efecty / Baloto", fee: 0.048, color: "#f97316" },
  { id: "paypal", label: "PayPal", fee: 0.042, color: "#3b82f6" },
  { id: "remitly", label: "Remitly", fee: 0.022, color: "#22c55e" },
  { id: "wise", label: "Wise", fee: 0.012, color: "#22c55e" },
] as const;

const OPTIMAL_FEE = 0.005; // mejor fintech / cuenta USD
const BEST_FINTECH_FEE = 0.005;

type MetodoId = (typeof METODOS)[number]["id"];

function formatUSD(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CalculadoraClient() {
  const [monto, setMonto] = useState<string>("500");
  const [metodoId, setMetodoId] = useState<MetodoId>("western_union");
  const [showResults, setShowResults] = useState(false);
  const [emailDone, setEmailDone] = useState(false);

  const montoNum = Math.max(0, parseFloat(monto) || 0);
  const metodo = METODOS.find((m) => m.id === metodoId) ?? METODOS[0];
  const perdidaMensual = montoNum * metodo.fee;
  const perdidaAnual = perdidaMensual * 12;
  const costoOptimo = montoNum * BEST_FINTECH_FEE * 12;
  const ahorroAnual = perdidaAnual - costoOptimo;
  const porcentajeAhorro = metodo.fee > 0 ? ((metodo.fee - OPTIMAL_FEE) / metodo.fee) * 100 : 0;

  const calcData = {
    monto_mensual: montoNum,
    metodo: metodo.label,
    metodo_fee_pct: metodo.fee * 100,
    perdida_mensual: Math.round(perdidaMensual * 100) / 100,
    perdida_anual: Math.round(perdidaAnual * 100) / 100,
    ahorro_potencial: Math.round(ahorroAnual * 100) / 100,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 text-xs text-red-400 font-medium mb-4">
          💸 El dato que los bancos no quieren que sepas
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-100 leading-tight mb-4">
          ¿Cuánto pierde tu familia en remesas?
        </h1>
        <p className="text-slate-400 text-lg">
          El colombiano promedio pierde entre <strong className="text-red-400">$400 y $1,200 USD al año</strong>{" "}
          en comisiones que nadie les explica. Calcula cuánto es tu caso.
        </p>
      </div>

      {/* Calculator inputs */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 md:p-8 space-y-6">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            ¿Cuánto envías o recibes por mes? (USD)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              min="0"
              max="50000"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-lg font-bold text-slate-100 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-colors"
              placeholder="500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USD</span>
          </div>
          {/* Quick amounts */}
          <div className="flex gap-2 mt-2">
            {[200, 500, 1000, 2000].map((v) => (
              <button
                key={v}
                onClick={() => setMonto(String(v))}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  monto === String(v)
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            ¿Qué método usas actualmente?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetodoId(m.id)}
                className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  metodoId === m.id
                    ? "bg-slate-700 border-slate-500 text-slate-100"
                    : "bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: metodoId === m.id ? m.color : "#64748b" }}
                >
                  ~{(m.fee * 100).toFixed(1)}% en fees
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Instant teaser result */}
        {montoNum > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Pierdes al mes con {metodo.label}</p>
                <p className="text-2xl font-bold text-red-400">{formatUSD(perdidaMensual)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">Al año</p>
                <p className="text-2xl font-bold text-red-400">{formatUSD(perdidaAnual)}</p>
              </div>
            </div>
          </div>
        )}

        {/* CTA to show full results */}
        {!showResults && (
          <button
            onClick={() => setShowResults(true)}
            disabled={montoNum <= 0}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold py-4 px-6 rounded-xl text-base transition-all"
          >
            Ver análisis completo + mejores opciones →
          </button>
        )}
      </div>

      {/* Full results — gated behind email if not done */}
      {showResults && (
        <div className="space-y-6">
          {/* Breakdown */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-5">Tu análisis completo</h2>

            {/* Cost comparison bars */}
            <div className="space-y-3 mb-6">
              {METODOS.map((m) => {
                const perdida = montoNum * m.fee * 12;
                const pct = (m.fee / METODOS[0].fee) * 100;
                return (
                  <div key={m.id} className={`${m.id === metodoId ? "opacity-100" : "opacity-60"}`}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium ${m.id === metodoId ? "text-slate-200" : "text-slate-500"}`}>
                        {m.label} {m.id === metodoId && "← tu método"}
                      </span>
                      <span style={{ color: m.color }}>{formatUSD(perdida)}/año</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                );
              })}
              {/* Mejor fintech optimal */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-green-400">Mejor fintech (cuenta USD) ✓</span>
                  <span className="text-green-400">{formatUSD(costoOptimo)}/año</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-green-500"
                    style={{ width: `${(BEST_FINTECH_FEE / METODOS[0].fee) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Savings highlight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Pierdes con {metodo.label}</p>
                <p className="text-2xl font-bold text-red-400">{formatUSD(perdidaAnual)}</p>
                <p className="text-xs text-slate-600 mt-1">por año</p>
              </div>
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Ahorro potencial anual</p>
                <p className="text-2xl font-bold text-green-400">{formatUSD(ahorroAnual)}</p>
                <p className="text-xs text-slate-600 mt-1">{porcentajeAhorro.toFixed(0)}% menos</p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">
              Las 3 mejores opciones para colombianos
            </h2>
            <div className="space-y-3">
              {[
                {
                  name: "Cuenta USD offshore (banco panameño)",
                  desc: "Cuenta bancaria real en USD para colombianos. Fee real: ~0.5%. Sin comisiones de mantenimiento. Proceso 100% online.",
                  badge: "MEJOR OPCIÓN",
                  badgeColor: "bg-green-500/20 text-green-400 border-green-500/30",
                  href: "/guia/abrir-cuenta-dolares-paso-a-paso",
                },
                {
                  name: "Wise",
                  desc: "Para transferencias internacionales. Tasa de cambio interbancaria real. Fee: 0.4–1.5%.",
                  badge: "ALTERNATIVA",
                  badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
                  href: "https://wise.com",
                },
                {
                  name: "Remitly",
                  desc: "Para enviar a familia. Mejor que bancos tradicionales. Fee: 1–3%.",
                  badge: "PARA ENVÍOS",
                  badgeColor: "bg-slate-500/20 text-slate-400 border-slate-500/30",
                  href: "https://remitly.com",
                },
              ].map((opt, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 bg-slate-900/40 rounded-xl border border-slate-700/40"
                >
                  <span className="text-green-400 font-bold text-lg shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-slate-100 text-sm">{opt.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email gate for results delivery */}
          {!emailDone ? (
            <EmailCaptureForm
              temaInteres="calculadora-remesas"
              intentScore={8}
              calculatorData={calcData as unknown as Record<string, unknown>}
              headline={`Recibe tu análisis completo por email`}
              subheadline={`Te envío el desglose exacto de cuánto ahorras + guía paso a paso para abrir tu cuenta USD offshore.`}
              ctaText="Enviar mi análisis →"
              onSuccess={() => setEmailDone(true)}
            />
          ) : (
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 text-center">
              <p className="text-green-400 font-medium">
                ✅ Análisis enviado a tu correo. ¡Revisa tu bandeja!
              </p>
            </div>
          )}

          {/* Share */}
          <div className="text-center text-sm text-slate-600">
            <p>
              ¿Conoces a alguien que usa Western Union?{" "}
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.share) {
                    navigator.share({
                      title: "Calculadora de remesas — Dólar Afuera",
                      text: `Acabo de calcular que pierdo ${formatUSD(perdidaAnual)} al año en remesas. Calcula cuánto pierdes tú.`,
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard?.writeText(window.location.href);
                  }
                }}
                className="text-green-400 hover:text-green-300 font-medium"
              >
                Comparte esta calculadora →
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
