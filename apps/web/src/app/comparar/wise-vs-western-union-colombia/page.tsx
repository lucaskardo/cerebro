import type { Metadata } from "next";
import EmailCaptureForm from "@/components/EmailCaptureForm";

const SITE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

export const metadata: Metadata = {
  title: "Wise vs Western Union Colombia 2026 — Comparativa Real | Dólar Afuera",
  description: "Comparativa honesta: tarifas reales, velocidad y seguridad de Wise vs Western Union para colombianos. Con calculadora incluida.",
  alternates: { canonical: `${SITE_URL}/comparar/wise-vs-western-union-colombia` },
  openGraph: {
    title: "Wise vs Western Union Colombia 2026",
    description: "Comparativa real de tarifas y velocidad para colombianos",
    url: `${SITE_URL}/comparar/wise-vs-western-union-colombia`,
    type: "article",
    siteName: "Dólar Afuera",
  },
};

const comparison = [
  { feature: "Tarifa envío $500 USD", wise: "~$4.50 (0.9%)", wu: "~$12–25 (2.4–5%)", winner: "wise" },
  { feature: "Tipo de cambio", wise: "Tasa mid-market real", wu: "Margen 2–4% oculto", winner: "wise" },
  { feature: "Velocidad", wise: "1–2 días hábiles", wu: "Minutos (en efectivo)", winner: "wu" },
  { feature: "Límite envío", wise: "Hasta $1M USD/año", wu: "$2,500 USD por transacción", winner: "wise" },
  { feature: "Cuenta en USD", wise: "Sí (número cuenta real)", wu: "No", winner: "wise" },
  { feature: "App móvil", wise: "Excelente (4.8★)", wu: "Buena (4.3★)", winner: "wise" },
  { feature: "Recibir pagos internacionales", wise: "Sí (SWIFT, SEPA, ACH)", wu: "No", winner: "wise" },
  { feature: "Costo mensual", wise: "$0 cuenta básica", wu: "$0 (sin cuenta)", winner: "tie" },
  { feature: "Disponible en Colombia", wise: "Sí (con cédula)", wu: "Sí (desde 1994)", winner: "tie" },
  { feature: "Regulación", wise: "FCA UK + múltiples", wu: "FinCEN + 50 países", winner: "tie" },
];

export default function WiseVsWesternUnionPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Wise vs Western Union Colombia 2026",
            description: "Comparativa real de tarifas, velocidad y seguridad",
            author: { "@type": "Person", name: "Carlos Medina" },
            publisher: { "@type": "Organization", name: "Dólar Afuera", url: SITE_URL },
            datePublished: "2026-01-01",
            dateModified: new Date().toISOString(),
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/comparar/wise-vs-western-union-colombia` },
          }),
        }}
      />

      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header */}
        <header>
          <nav className="text-xs text-slate-600 mb-6 flex items-center gap-2">
            <a href="/" className="hover:text-slate-400">Inicio</a>
            <span>›</span>
            <span className="text-slate-500">Comparativas</span>
            <span>›</span>
            <span className="text-slate-500">Wise vs Western Union</span>
          </nav>
          <div className="inline-block text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1 rounded-full mb-4">
            Actualizado 2026
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 leading-tight mb-4">
            Wise vs Western Union para colombianos: La comparativa real
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Comparamos tarifas reales, tipo de cambio y velocidad. Spoiler: la diferencia es mayor de lo que crees.
          </p>
        </header>

        {/* TL;DR Winner */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6">
          <div className="text-xs font-medium text-green-400 uppercase tracking-wide mb-2">Veredicto</div>
          <p className="text-slate-200 font-medium">
            <strong className="text-green-400">Wise gana en casi todo</strong> — especialmente si necesitas enviar más de $200 USD o quieres una cuenta real en dólares. Western Union solo tiene ventaja si el destinatario necesita <strong>efectivo en minutos</strong>.
          </p>
        </div>

        {/* Comparison table */}
        <section>
          <h2 className="text-xl font-bold text-slate-100 mb-4">Tabla comparativa completa</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/80">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Característica</th>
                  <th className="text-center px-4 py-3 text-blue-400 font-medium">Wise</th>
                  <th className="text-center px-4 py-3 text-yellow-400 font-medium">Western Union</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-700/30 ${i % 2 === 0 ? "bg-slate-800/30" : "bg-slate-800/10"}`}>
                    <td className="px-4 py-3 text-slate-300">{row.feature}</td>
                    <td className={`px-4 py-3 text-center ${row.winner === "wise" ? "text-green-400 font-medium" : "text-slate-400"}`}>
                      {row.winner === "wise" && <span className="mr-1">✓</span>}{row.wise}
                    </td>
                    <td className={`px-4 py-3 text-center ${row.winner === "wu" ? "text-green-400 font-medium" : "text-slate-400"}`}>
                      {row.winner === "wu" && <span className="mr-1">✓</span>}{row.wu}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Example calculation */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4">Ejemplo real: enviar $500 USD</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <div className="text-xs text-blue-400 font-medium mb-2">CON WISE</div>
              <div className="text-2xl font-bold text-slate-100">$4.50</div>
              <div className="text-xs text-slate-500 mt-1">tarifa total</div>
              <div className="text-sm text-slate-400 mt-3">Tipo de cambio: real</div>
              <div className="text-sm text-green-400 font-medium">Recibe: ~$2,045,000 COP</div>
            </div>
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <div className="text-xs text-yellow-400 font-medium mb-2">CON WESTERN UNION</div>
              <div className="text-2xl font-bold text-slate-100">$18.00</div>
              <div className="text-xs text-slate-500 mt-1">tarifa + margen</div>
              <div className="text-sm text-slate-400 mt-3">Tipo de cambio: con margen</div>
              <div className="text-sm text-red-400 font-medium">Recibe: ~$1,955,000 COP</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-4">* Estimado. Tasas varían diariamente.</p>
        </section>

        {/* Recommendation */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-100">¿Cuándo usar cada uno?</h2>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="font-medium text-blue-400 mb-2">Usa Wise cuando...</h3>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>✓ Envías más de $100 USD regularmente</li>
              <li>✓ Quieres una cuenta real en USD para recibir pagos</li>
              <li>✓ Tu destinatario tiene cuenta bancaria</li>
              <li>✓ Quieres el mejor tipo de cambio disponible</li>
            </ul>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="font-medium text-yellow-400 mb-2">Usa Western Union cuando...</h3>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>✓ El destinatario necesita efectivo en minutos</li>
              <li>✓ No tiene cuenta bancaria</li>
              <li>✓ Es una emergencia urgente</li>
            </ul>
          </div>
        </section>

        {/* Better alternative CTA */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6">
          <div className="text-sm font-bold text-green-400 mb-2">¿La mejor alternativa a ambos?</div>
          <p className="text-sm text-slate-400 mb-4">
            Si eres colombiano y quieres una cuenta en USD <strong className="text-slate-300">permanente</strong> — no solo para transferencias, sino para <strong className="text-slate-300">guardar dólares, recibir pagos internacionales y proteger tus ahorros</strong> — una cuenta offshore en banco panameño es la opción más completa.
          </p>
          <a
            href="/guia/abrir-cuenta-dolares-paso-a-paso"
            className="inline-block bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Ver guía: cómo abrir cuenta USD →
          </a>
        </div>

        {/* Email capture */}
        <EmailCaptureForm
          origenUrl={`${SITE_URL}/comparar/wise-vs-western-union-colombia`}
          temaInteres="comparativa wise western union"
          intentScore={7}
          headline="Recibe la guía completa de opciones para colombianos"
          subheadline="Te envío el comparativo completo de todas las opciones: Wise, Nequi, cuentas offshore y más."
          ctaText="Enviar guía gratis →"
        />

        {/* Related links */}
        <div className="border-t border-slate-800 pt-8">
          <h3 className="text-sm font-medium text-slate-400 mb-3">También te puede interesar</h3>
          <div className="space-y-2">
            <a href="/herramientas/calculadora-remesas" className="block text-sm text-green-400 hover:text-green-300">→ Calculadora: ¿Cuánto pierdes enviando remesas?</a>
            <a href="/herramientas/quiz-cuenta-ideal" className="block text-sm text-green-400 hover:text-green-300">→ Quiz: ¿Qué cuenta en dólares es ideal para ti?</a>
            <a href="/guia/abrir-cuenta-dolares-paso-a-paso" className="block text-sm text-green-400 hover:text-green-300">→ Guía paso a paso: Abrir cuenta en dólares desde Colombia</a>
          </div>
        </div>
      </div>
    </>
  );
}
