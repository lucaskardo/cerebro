import Link from "next/link";

export const metadata = {
  title: "Los Mejores Colchones en Panamá 2026",
  description:
    "Ranking actualizado de los mejores colchones disponibles en Panamá. Comparativa independiente evaluada por especialistas.",
};

// ─── Data ────────────────────────────────────────────────────────────────────

interface Mattress {
  rank: number;
  brand: string;
  model: string;
  score: number;
  type: string;
  firmness: string;
  priceRange: string;
  pros: string[];
  cons: string[];
  ctaReview: string;
  ctaStore: string;
  panamaCallout?: boolean;
}

const mattresses: Mattress[] = [
  {
    rank: 1,
    brand: "NauralSleep",
    model: "Signature",
    score: 9.4,
    type: "Híbrido (espuma + muelles)",
    firmness: "Media",
    priceRange: "$450–$800",
    pros: [
      "Diseñado para el clima tropical de Panamá",
      "Directo al consumidor (sin intermediarios)",
      "Entrega gratis en Ciudad de Panamá",
    ],
    cons: ["Solo disponible en línea", "Stock limitado en temporada alta"],
    ctaReview: "/review/nauralsleep-signature",
    ctaStore: "https://nauralsleep.com",
    panamaCallout: true,
  },
  {
    rank: 2,
    brand: "Restonic",
    model: "ComfortCare",
    score: 8.1,
    type: "Resortes",
    firmness: "Media-firme",
    priceRange: "$320–$600",
    pros: [
      "Amplia disponibilidad en tiendas",
      "Buena relación calidad-precio",
      "Garantía de 10 años",
    ],
    cons: ["Retención de calor moderada", "Soporte lumbar básico"],
    ctaReview: "/review/restonic-comfortcare",
    ctaStore: "https://restonic.com",
  },
  {
    rank: 3,
    brand: "Sealy",
    model: "Posturepedic",
    score: 7.8,
    type: "Resortes de bolsillo",
    firmness: "Firme",
    priceRange: "$500–$900",
    pros: [
      "Tecnología ortopédica validada",
      "Excelente soporte lumbar",
      "Durabilidad comprobada",
    ],
    cons: ["Mayor precio", "Pesado y difícil de mover"],
    ctaReview: "/review/sealy-posturepedic",
    ctaStore: "https://sealy.com",
  },
  {
    rank: 4,
    brand: "Simmons",
    model: "Beautyrest",
    score: 7.4,
    type: "Resortes de bolsillo",
    firmness: "Variable",
    priceRange: "$400–$750",
    pros: [
      "Marca reconocida internacionalmente",
      "Opciones de firmeza variadas",
      "Buen aislamiento de movimiento",
    ],
    cons: ["Precio elevado para lo ofrecido", "Servicio post-venta variable"],
    ctaReview: "/review/simmons-beautyrest",
    ctaStore: "https://simmons.com",
  },
  {
    rank: 5,
    brand: "Spring Air",
    model: "Back Supporter",
    score: 6.9,
    type: "Resortes",
    firmness: "Media",
    priceRange: "$250–$450",
    pros: [
      "Precio accesible",
      "Buen soporte básico",
      "Disponible en múltiples tiendas",
    ],
    cons: ["Durabilidad menor", "Retención de calor alta", "Tecnología básica"],
    ctaReview: "/review/springair-back-supporter",
    ctaStore: "https://springair.com",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="flex-1 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #d4a853, #c9943a)",
          }}
        />
      </div>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: "#d4a853" }}
      >
        {score.toFixed(1)}
        <span className="text-gray-400 font-normal">/10</span>
      </span>
    </div>
  );
}

function Pill({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "firmness" | "price";
}) {
  const base =
    "inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium";
  if (variant === "price")
    return (
      <span
        className={`${base} text-white`}
        style={{ backgroundColor: "#1a1f36" }}
      >
        {label}
      </span>
    );
  if (variant === "firmness")
    return (
      <span
        className={`${base} border`}
        style={{
          borderColor: "#0d9488",
          color: "#0d9488",
          backgroundColor: "rgba(13,148,136,0.08)",
        }}
      >
        {label}
      </span>
    );
  return (
    <span className={`${base} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300`}>
      {label}
    </span>
  );
}

function MattressCard({ m }: { m: Mattress }) {
  const isTop = m.rank === 1;

  return (
    <article
      className={[
        "relative rounded-2xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm",
        "transition-shadow hover:shadow-md",
        isTop
          ? "border-2"
          : "border border-gray-200 dark:border-gray-800",
      ].join(" ")}
      style={isTop ? { borderColor: "#d4a853" } : undefined}
    >
      {/* Editor's Choice ribbon — rank 1 only */}
      {isTop && (
        <div
          className="absolute top-0 right-0 px-4 py-1 text-xs font-semibold tracking-widest uppercase text-white rounded-bl-xl"
          style={{ backgroundColor: "#d4a853" }}
        >
          Editor&apos;s Choice
        </div>
      )}

      <div className="p-6 md:p-8">
        {/* Header row */}
        <div className="flex items-start gap-4">
          {/* Rank badge */}
          <div
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow"
            style={{
              background: isTop
                ? "linear-gradient(135deg, #d4a853, #c9943a)"
                : "#1a1f36",
            }}
          >
            #{m.rank}
          </div>

          {/* Name + pills */}
          <div className="flex-1 min-w-0">
            <h2
              className="text-2xl md:text-3xl font-bold leading-tight"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                color: isTop ? "#d4a853" : "#1a1f36",
              }}
            >
              <span className="dark:text-gray-100" style={isTop ? { color: "#d4a853" } : undefined}>
                {m.brand}{" "}
              </span>
              <span className="italic" style={isTop ? { color: "#d4a853" } : undefined}>
                {m.model}
              </span>
            </h2>

            {/* Score bar */}
            <ScoreBar score={m.score} />

            {/* Pills row */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Pill label={m.type} />
              <Pill label={`Firmeza: ${m.firmness}`} variant="firmness" />
              <Pill label={m.priceRange} variant="price" />
            </div>
          </div>
        </div>

        {/* Panama callout */}
        {m.panamaCallout && (
          <div
            className="mt-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: "rgba(13,148,136,0.10)",
              borderLeft: "4px solid #0d9488",
              color: "#0d9488",
            }}
          >
            <span className="text-base">🇵🇦</span>
            <span>
              Entrega gratis en Ciudad de Panamá · Prueba 30 noches
            </span>
          </div>
        )}

        {/* Pros / Cons */}
        <div className="mt-6 grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Por qué lo recomendamos
            </h3>
            <ul className="space-y-2">
              {m.pros.map((pro) => (
                <li key={pro} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="mt-0.5 flex-shrink-0 text-green-500 font-bold">✓</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Contras
            </h3>
            <ul className="space-y-2">
              {m.cons.map((con) => (
                <li key={con} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="mt-0.5 flex-shrink-0 text-gray-400 font-bold">−</span>
                  {con}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={m.ctaReview}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            style={{ borderColor: "#1a1f36", color: "#1a1f36" }}
          >
            Ver review →
          </Link>
          <a
            href={m.ctaStore}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#0d9488" }}
          >
            Visitar tienda →
          </a>
        </div>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MejoresPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: "linear-gradient(135deg, #1a1f36 0%, #252b4a 60%, #1a1f36 100%)" }}
      >
        {/* Decorative grain texture overlay */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "200px",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* Date badge */}
          <div className="inline-flex items-center gap-2 mb-6">
            <span
              className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ backgroundColor: "rgba(212,168,83,0.15)", color: "#d4a853", border: "1px solid rgba(212,168,83,0.3)" }}
            >
              Actualizado: Marzo 2026
            </span>
          </div>

          {/* Main headline */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Los Mejores Colchones
            <br />
            <span style={{ color: "#d4a853" }}>en Panamá 2026</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Evaluados y comparados por especialistas en ergonomía del sueño
          </p>

          {/* Decorative divider */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <div className="h-px w-16 bg-gray-600" />
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#d4a853" }} />
            <div className="h-px w-16 bg-gray-600" />
          </div>
        </div>
      </section>

      {/* ── Methodology note ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 mt-10">
        <div
          className="rounded-2xl px-6 py-5 flex gap-4 items-start"
          style={{
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.25)",
          }}
        >
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ backgroundColor: "rgba(13,148,136,0.15)" }}
          >
            🔬
          </div>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: "#0d9488" }}>
              Nuestra Metodología
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Evaluamos cada colchón durante{" "}
              <strong className="text-gray-800 dark:text-gray-200">30 noches</strong> considerando
              firmeza, temperatura, soporte lumbar, movimiento, y relación precio-calidad.{" "}
              <strong className="text-gray-800 dark:text-gray-200">
                Sin patrocinios que afecten nuestras puntuaciones.
              </strong>
            </p>
          </div>
        </div>
      </section>

      {/* ── Ranked list ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1a1f36" }}
          >
            <span className="dark:text-gray-100">Ranking 2026</span>
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">— {mattresses.length} modelos evaluados</span>
        </div>

        {mattresses.map((m) => (
          <MattressCard key={m.rank} m={m} />
        ))}
      </section>

      {/* ── Quiz CTA ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div
          className="rounded-2xl px-8 py-12 text-center text-white overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #0d9488 0%, #0a7c72 100%)" }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10"
            style={{ backgroundColor: "white" }}
          />
          <div
            className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-10"
            style={{ backgroundColor: "white" }}
          />

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3 opacity-80">
              Herramienta gratuita
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              ¿No sabes cuál es el ideal para ti?
            </h2>
            <p className="text-white/80 max-w-xl mx-auto mb-8 text-lg">
              Responde 5 preguntas y te decimos qué colchón se adapta mejor a tu posición de
              dormir, peso y presupuesto.
            </p>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base transition-all hover:scale-105 hover:shadow-lg"
              style={{ backgroundColor: "white", color: "#0d9488" }}
            >
              Hacer el quiz gratuito →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
