import type { Metadata } from "next";
import { api } from "@/lib/api";
import Link from "next/link";
import EmailCaptureForm from "@/components/EmailCaptureForm";

const SITE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

export const metadata: Metadata = {
  title: "Dólar Afuera — Finanzas en USD para colombianos",
  description:
    "Guías, herramientas y estrategias para colombianos que quieren cuentas en dólares, protección cambiaria y mejores remesas.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Dólar Afuera — Finanzas en USD para colombianos",
    description:
      "Guías, herramientas y estrategias para colombianos que quieren cuentas en dólares, protección cambiaria y mejores remesas.",
    url: SITE_URL,
    type: "website",
    siteName: "Dólar Afuera",
  },
};

const BRANDS = [
  {
    slug: "mudateapanama",
    name: "Múdate a Panamá",
    tagline: "Todo lo que nadie te cuenta sobre vivir en Panamá",
    icon: "🏙️",
    color: "blue",
    badgeCls: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    borderCls: "border-blue-500/20 hover:border-blue-500/40",
    accentCls: "text-blue-300",
  },
  {
    slug: "dolarizate",
    name: "Dolarízate",
    tagline: "Protege tus ahorros. Muévete en dólares.",
    icon: "💵",
    color: "green",
    badgeCls: "text-green-400 bg-green-400/10 border-green-400/20",
    borderCls: "border-green-500/20 hover:border-green-500/40",
    accentCls: "text-green-300",
  },
  {
    slug: "remesas",
    name: "Remesas.co",
    tagline: "Envía más. Pierde menos. Cada peso cuenta.",
    icon: "💸",
    color: "orange",
    badgeCls: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    borderCls: "border-orange-500/20 hover:border-orange-500/40",
    accentCls: "text-orange-300",
  },
];

const TOOLS = [
  {
    label: "Calculadora de Remesas",
    description: "¿Cuánto llega realmente? Compara tarifas en tiempo real.",
    href: "/calculadora-remesas",
    icon: "🧮",
  },
  {
    label: "Quiz: ¿Qué cuenta es para mí?",
    description: "Encuentra la cuenta en USD ideal para tu situación en 2 minutos.",
    href: "/quiz-cuenta-ideal",
    icon: "🎯",
  },
  {
    label: "Wise vs Western Union",
    description: "Comparativa honesta: quién cobra menos para enviar a Colombia.",
    href: "/comparar/wise-vs-western-union-colombia",
    icon: "⚖️",
  },
];

const TRUST_SIGNALS = [
  { text: "Datos verificados semanalmente", icon: "✅" },
  { text: "Sin conflictos de interés", icon: "🔍" },
  { text: "Comparativas honestas", icon: "⚖️" },
  { text: "+15,000 colombianos informados", icon: "🇨🇴" },
];

export default async function HomePage() {
  let articles: Awaited<ReturnType<typeof api.content>> = [];
  try {
    articles = await api.content("approved");
  } catch {
    articles = [];
  }

  const featuredArticles = articles.slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Dólar Afuera",
            url: SITE_URL,
            description:
              "Guías y herramientas para colombianos que quieren finanzas en dólares.",
          }),
        }}
      />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="-mx-4 px-6 sm:px-12 py-24 mb-16 bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-green-500/30 text-green-400 bg-green-400/10 mb-6">
            Para colombianos · Cuentas en USD · Remesas
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold text-slate-50 leading-tight tracking-tight mb-6">
            Tu dinero trabaja más{" "}
            <span className="text-green-400">en dólares</span>
          </h1>

          <p className="text-slate-300 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Guías y herramientas para colombianos que quieren cuentas en USD,
            protección cambiaria y mejores remesas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/articulos"
              className="inline-block bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-sm px-7 py-3.5 rounded-xl transition-colors"
            >
              Explorar guías →
            </Link>
            <a
              href="#email-capture"
              className="inline-block bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-7 py-3.5 rounded-xl transition-colors"
            >
              Recibe la guía gratis →
            </a>
          </div>
        </div>
      </section>

      <div className="space-y-20">
        {/* ── BRANDS ──────────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Nuestras publicaciones</h2>
            <p className="text-slate-400 text-sm">Tres marcas especializadas, un mismo propósito.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {BRANDS.map((brand) => (
              <Link
                key={brand.slug}
                href={`/marca/${brand.slug}`}
                className={`block bg-slate-800/50 border rounded-2xl p-6 transition-all group ${brand.borderCls}`}
              >
                <div className="text-4xl mb-4">{brand.icon}</div>
                <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${brand.accentCls}`}>
                  {brand.color === "blue"
                    ? "Relocación"
                    : brand.color === "green"
                    ? "Inversiones"
                    : "Remesas"}
                </div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-white mb-2 transition-colors">
                  {brand.name}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{brand.tagline}</p>
                <div className={`mt-4 text-xs font-medium ${brand.accentCls} group-hover:underline`}>
                  Ver publicación →
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── TOOLS ───────────────────────────────────────────────────── */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Herramientas gratuitas</h2>
            <p className="text-slate-400 text-sm">Toma mejores decisiones financieras en minutos.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="block bg-slate-800/50 border border-slate-700/50 hover:border-green-500/30 rounded-2xl p-6 transition-all group"
              >
                <div className="text-3xl mb-4">{tool.icon}</div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-green-300 mb-2 transition-colors leading-snug">
                  {tool.label}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{tool.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FEATURED ARTICLES ───────────────────────────────────────── */}
        {featuredArticles.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 mb-1">Últimas guías</h2>
                <p className="text-slate-400 text-sm">Contenido actualizado para colombianos.</p>
              </div>
              <Link
                href="/articulos"
                className="text-sm text-green-400 hover:text-green-300 font-medium transition-colors"
              >
                Ver todos →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {featuredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articulo/${article.slug}`}
                  className="block bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 rounded-xl p-5 transition-all group"
                >
                  <h3 className="font-semibold text-slate-200 group-hover:text-white leading-snug line-clamp-2 text-sm mb-3">
                    {article.title.replace("[GENERATING] ", "")}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600 font-mono line-clamp-1">
                      {article.keyword}
                    </div>
                    <div className="text-xs text-slate-700 shrink-0 ml-2">
                      {new Date(article.created_at).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── TRUST SIGNALS ───────────────────────────────────────────── */}
        <section className="-mx-4 px-6 py-10 bg-slate-800/30 border-y border-slate-700/30">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {TRUST_SIGNALS.map((signal) => (
                <div key={signal.text} className="space-y-2">
                  <div className="text-2xl">{signal.icon}</div>
                  <div className="text-xs text-slate-400 font-medium leading-snug">
                    {signal.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── EMAIL CAPTURE ───────────────────────────────────────────── */}
        <section className="max-w-lg mx-auto">
          <EmailCaptureForm
            origenUrl={SITE_URL}
            temaInteres="finanzas colombianos"
            intentScore={5}
            headline="Recibe las mejores guías financieras para colombianos"
            subheadline="Cada semana: cuentas en USD, remesas y protección cambiaria. Sin spam."
            ctaText="Suscribirme gratis →"
          />
        </section>
      </div>
    </>
  );
}
