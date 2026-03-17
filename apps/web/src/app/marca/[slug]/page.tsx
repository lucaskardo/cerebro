import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import EmailCaptureForm from "@/components/EmailCaptureForm";

const SITE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

const BRANDS: Record<string, {
  name: string;
  slug: string;
  domain: string;
  siteId: string;
  persona: string;
  role: string;
  bio: string;
  tagline: string;
  description: string;
  color: string;
  topics: string[];
  ctaText: string;
  ctaUrl: string;
  icon: string;
  heroGradient: string;
  stats: Array<{ label: string; value: string }>;
}> = {
  mudateapanama: {
    name: "Múdate a Panamá",
    slug: "mudateapanama",
    domain: "mudateapanama.com",
    siteId: "9fef51f1-e8d1-4b3c-965d-8e21df84abfa",
    persona: "Ana Gutiérrez",
    role: "Asesora de Relocación",
    bio: "Llevo 8 años ayudando a latinoamericanos a hacer su vida en Panamá sin sorpresas — bancos, visas y barrios, todo claro desde el día uno.",
    tagline: "Todo lo que nadie te cuenta sobre vivir en Panamá",
    description: "Guías prácticas para emprendedores, profesionales remotos y familias que quieren instalarse en Panamá. Visa, bancos, barrios, salud y negocio — sin adornos.",
    color: "blue",
    topics: ["Visa pensionado", "Costo de vida", "Barrios", "Salud", "Negocios", "Banca"],
    ctaText: "Abre tu cuenta bancaria panameña →",
    ctaUrl: "https://ikigii.com",
    icon: "🏙️",
    heroGradient: "bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-900",
    stats: [
      { label: "Asesorando familias", value: "8 años" },
      { label: "Familias relocalizadas", value: "500+" },
      { label: "Guías completas", value: "3 guías" },
    ],
  },
  dolarizate: {
    name: "Dolarízate",
    slug: "dolarizate",
    domain: "dolarizate.co",
    siteId: "76f67ce7-7b1f-4583-b79a-0792a7f0a278",
    persona: "Carlos Medina",
    role: "Especialista en Finanzas Internacionales",
    bio: "Con más de 10 años en banca LATAM, ayudo a colombianos a sacar sus ahorros del peso sin trucos ni riesgos: cuentas reales, datos reales.",
    tagline: "Protege tus ahorros. Muévete en dólares.",
    description: "Guías directas para latinoamericanos que quieren dolarizar sus ahorros, abrir cuentas en USD y protegerse de la devaluación. Datos reales, sin jerga.",
    color: "green",
    topics: ["Cuentas USD", "Protección cambiaria", "Crypto", "Inversiones", "Offshore legal", "Bancos internacionales"],
    ctaText: "Abre tu cuenta en dólares →",
    ctaUrl: "https://ikigii.com",
    icon: "💵",
    heroGradient: "bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-900",
    stats: [
      { label: "En banca LATAM", value: "10 años" },
      { label: "Lectores activos", value: "15,000+" },
      { label: "Con ikigii", value: "$0 comisiones" },
    ],
  },
  remesas: {
    name: "Remesas.co",
    slug: "remesas",
    domain: "remesas.co",
    siteId: "a9296df7-dbf2-4f3e-99e0-24f7e09931c3",
    persona: "Diego Restrepo",
    role: "Experto en Transferencias Internacionales",
    bio: "Comparo 12 operadores de remesas cada semana para que tú no pierdas ni un peso enviando dinero a Colombia — o recibiéndolo desde el exterior.",
    tagline: "Envía más. Pierde menos. Cada peso cuenta.",
    description: "Comparativas honestas de operadores de remesas para latinoamericanos. Encontramos la manera más barata de que tu dinero llegue completo.",
    color: "orange",
    topics: ["Enviar dinero", "Comparar tarifas", "Wise vs WU", "Tasa de cambio", "Apps de remesas", "Recibir sin comisiones"],
    ctaText: "Recibe más con cuenta USD →",
    ctaUrl: "https://ikigii.com",
    icon: "💸",
    heroGradient: "bg-gradient-to-br from-slate-950 via-orange-950/30 to-slate-900",
    stats: [
      { label: "Operadores comparados", value: "12 operadores" },
      { label: "Ahorro posible en envíos", value: "Hasta 40%" },
      { label: "Frecuencia de actualización", value: "Semanal" },
    ],
  },
};

const COLOR_MAP: Record<string, {
  badge: string;
  accent: string;
  accentStrong: string;
  button: string;
  border: string;
  statBorder: string;
  tagBg: string;
  avatarBg: string;
  cardHover: string;
  toolCard: string;
}> = {
  blue: {
    badge: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    accent: "text-blue-400",
    accentStrong: "text-blue-300",
    button: "bg-blue-500 hover:bg-blue-400 text-white",
    border: "border-blue-500/20 bg-blue-500/5",
    statBorder: "border-blue-500/20",
    tagBg: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    avatarBg: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    cardHover: "hover:border-blue-500/40 hover:bg-blue-500/5",
    toolCard: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15",
  },
  green: {
    badge: "text-green-400 bg-green-400/10 border-green-400/20",
    accent: "text-green-400",
    accentStrong: "text-green-300",
    button: "bg-green-500 hover:bg-green-400 text-slate-900",
    border: "border-green-500/20 bg-green-500/5",
    statBorder: "border-green-500/20",
    tagBg: "bg-green-500/10 text-green-300 border-green-500/20",
    avatarBg: "bg-green-500/20 text-green-300 border border-green-500/30",
    cardHover: "hover:border-green-500/40 hover:bg-green-500/5",
    toolCard: "bg-green-500/10 border-green-500/20 hover:bg-green-500/15",
  },
  orange: {
    badge: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    accent: "text-orange-400",
    accentStrong: "text-orange-300",
    button: "bg-orange-500 hover:bg-orange-400 text-white",
    border: "border-orange-500/20 bg-orange-500/5",
    statBorder: "border-orange-500/20",
    tagBg: "bg-orange-500/10 text-orange-300 border-orange-500/20",
    avatarBg: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
    cardHover: "hover:border-orange-500/40 hover:bg-orange-500/5",
    toolCard: "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15",
  },
};

const TOOLS = [
  { label: "Calculadora de remesas", href: "/calculadora-remesas", icon: "🧮" },
  { label: "Quiz: ¿Qué cuenta es para mí?", href: "/quiz-cuenta-ideal", icon: "🎯" },
  { label: "Comparar: Wise vs Western Union", href: "/comparar/wise-vs-western-union-colombia", icon: "⚖️" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = BRANDS[slug];
  if (!brand) return { title: "Marca no encontrada" };
  return {
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    alternates: { canonical: `${SITE_URL}/marca/${slug}` },
    openGraph: {
      title: brand.name,
      description: brand.description,
      url: `${SITE_URL}/marca/${slug}`,
      type: "website",
      siteName: "Dólar Afuera",
    },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = BRANDS[slug];
  if (!brand) return notFound();

  const colors = COLOR_MAP[brand.color];

  let allArticles: Awaited<ReturnType<typeof api.content>> = [];
  try {
    allArticles = await api.content("approved");
  } catch {
    allArticles = [];
  }

  // Filter by siteId when possible, fall back to all articles
  const siteArticles = allArticles.filter((a) => (a as { site_id?: string }).site_id === brand.siteId);
  const articles = siteArticles.length > 0 ? siteArticles : allArticles;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: brand.name,
            description: brand.description,
            url: `${SITE_URL}/marca/${slug}`,
            author: {
              "@type": "Person",
              name: brand.persona,
              jobTitle: brand.role,
            },
          }),
        }}
      />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className={`-mx-4 px-6 sm:px-12 py-20 mb-12 ${brand.heroGradient}`}>
        <div className="max-w-3xl mx-auto">
          {/* Domain badge */}
          <div className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border mb-6 ${colors.badge}`}>
            {brand.domain}
          </div>

          {/* Icon + name */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-6xl">{brand.icon}</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-50 leading-tight tracking-tight">
              {brand.name}
            </h1>
          </div>

          {/* Tagline */}
          <p className={`text-xl sm:text-2xl font-medium italic mb-4 ${colors.accentStrong}`}>
            {brand.tagline}
          </p>

          {/* Description */}
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl">
            {brand.description}
          </p>

          {/* CTA */}
          <a
            href={brand.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block font-bold text-sm px-7 py-3.5 rounded-xl transition-colors mb-8 ${colors.button}`}
          >
            {brand.ctaText}
          </a>

          {/* Topic tags */}
          <div className="flex flex-wrap gap-2">
            {brand.topics.map((t) => (
              <span
                key={t}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium ${colors.tagBg}`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-14">
        {/* ── AUTHOR SPOTLIGHT ────────────────────────────────────────── */}
        <section>
          <div className={`rounded-2xl border p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start ${colors.border}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 ${colors.avatarBg}`}>
              {brand.persona[0]}
            </div>
            <div className="flex-1">
              <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${colors.accent}`}>
                Autor
              </div>
              <div className="text-xl font-bold text-slate-100 mb-1">{brand.persona}</div>
              <div className="text-sm text-slate-400 mb-3">{brand.role}</div>
              <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                {brand.bio}
              </p>
            </div>
          </div>
        </section>

        {/* ── STATS ROW ───────────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {brand.stats.map((stat) => (
              <div
                key={stat.label}
                className={`bg-slate-800/50 border rounded-xl p-5 text-center ${colors.statBorder}`}
              >
                <div className={`text-2xl font-bold mb-1 ${colors.accentStrong}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500 leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ARTICLES GRID ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-slate-100 mb-5">
            Artículos{articles.length > 0 ? ` (${articles.length})` : ""}
          </h2>

          {articles.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articulo/${article.slug}`}
                  className={`block bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 transition-all group ${colors.cardHover}`}
                >
                  <div className="font-semibold text-slate-200 group-hover:text-white leading-snug line-clamp-2 text-sm mb-3">
                    {article.title.replace("[GENERATING] ", "")}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600 font-mono">{article.keyword}</div>
                    <div className="text-xs text-slate-700">
                      {new Date(article.created_at).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-600">
              <div className="text-4xl mb-4">{brand.icon}</div>
              <p className="text-sm">Los artículos de {brand.name} se están generando.</p>
              <p className="text-xs mt-2">Vuelve en unos minutos.</p>
            </div>
          )}
        </section>

        {/* ── TOOLS ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-slate-100 mb-5">Herramientas gratuitas</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={`flex items-center gap-3 border rounded-xl p-4 transition-all group ${colors.toolCard}`}
              >
                <span className="text-2xl">{tool.icon}</span>
                <span className={`text-sm font-medium group-hover:text-white transition-colors ${colors.accentStrong}`}>
                  {tool.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── NEWSLETTER ──────────────────────────────────────────────── */}
        <EmailCaptureForm
          origenUrl={`${SITE_URL}/marca/${slug}`}
          temaInteres={brand.name.toLowerCase()}
          intentScore={6}
          headline={`Recibe las mejores guías de ${brand.name}`}
          subheadline={`${brand.persona} te envía cada semana las guías más útiles para tu situación.`}
          ctaText="Suscribirme gratis →"
        />
      </div>
    </>
  );
}
