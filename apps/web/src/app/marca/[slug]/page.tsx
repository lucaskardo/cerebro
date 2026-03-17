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
  tagline: string;
  description: string;
  color: string;
  topics: string[];
  ctaText: string;
  ctaUrl: string;
  icon: string;
}> = {
  mudateapanama: {
    name: "Múdate a Panamá",
    slug: "mudateapanama",
    domain: "mudateapanama.com",
    siteId: "9fef51f1-e8d1-4b3c-965d-8e21df84abfa",
    persona: "Ana Gutiérrez",
    role: "Asesora de Relocación · 8 años ayudando a latinoamericanos",
    tagline: "Todo lo que nadie te cuenta sobre vivir en Panamá",
    description: "Guías prácticas para emprendedores, profesionales remotos y familias que quieren instalarse en Panamá. Visa, bancos, barrios, salud y negocio — sin adornos.",
    color: "blue",
    topics: ["Visa pensionado", "Costo de vida", "Barrios", "Salud", "Negocios", "Banca"],
    ctaText: "Abre tu cuenta bancaria panameña →",
    ctaUrl: "https://ikigii.com",
    icon: "🏙️",
  },
  dolarizate: {
    name: "Dolarízate",
    slug: "dolarizate",
    domain: "dolarizate.co",
    siteId: "76f67ce7-7b1f-4583-b79a-0792a7f0a278",
    persona: "Carlos Medina",
    role: "Especialista en Finanzas Internacionales · 10+ años en banca LATAM",
    tagline: "Protege tus ahorros. Muévete en dólares.",
    description: "Guías directas para latinoamericanos que quieren dolarizar sus ahorros, abrir cuentas en USD y protegerse de la devaluación. Datos reales, sin jerga.",
    color: "green",
    topics: ["Cuentas USD", "Protección cambiaria", "Crypto", "Inversiones", "Offshore legal", "Bancos internacionales"],
    ctaText: "Abre tu cuenta en dólares →",
    ctaUrl: "https://ikigii.com",
    icon: "💵",
  },
  remesas: {
    name: "Remesas.co",
    slug: "remesas",
    domain: "remesas.co",
    siteId: "a9296df7-dbf2-4f3e-99e0-24f7e09931c3",
    persona: "Diego Restrepo",
    role: "Experto en Transferencias Internacionales · Finanzas migrantes",
    tagline: "Envía más. Pierde menos. Cada peso cuenta.",
    description: "Comparativas honestas de operadores de remesas para latinoamericanos. Encontramos la manera más barata de que tu dinero llegue completo.",
    color: "orange",
    topics: ["Enviar dinero", "Comparar tarifas", "Wise vs WU", "Tasa de cambio", "Apps de remesas", "Recibir sin comisiones"],
    ctaText: "Recibe más con cuenta USD →",
    ctaUrl: "https://ikigii.com",
    icon: "💸",
  },
};

const COLOR_MAP: Record<string, { badge: string; accent: string; button: string; border: string }> = {
  blue: {
    badge: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    accent: "text-blue-400",
    button: "bg-blue-500 hover:bg-blue-400 text-white",
    border: "border-blue-500/20 bg-blue-500/5",
  },
  green: {
    badge: "text-green-400 bg-green-400/10 border-green-400/20",
    accent: "text-green-400",
    button: "bg-green-500 hover:bg-green-400 text-slate-900",
    border: "border-green-500/20 bg-green-500/5",
  },
  orange: {
    badge: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    accent: "text-orange-400",
    button: "bg-orange-500 hover:bg-orange-400 text-white",
    border: "border-orange-500/20 bg-orange-500/5",
  },
};

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

  let articles: Awaited<ReturnType<typeof api.content>> = [];
  try {
    articles = await api.content("approved");
  } catch {
    articles = [];
  }

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

      <div className="space-y-12">
        {/* Brand header */}
        <header className={`rounded-2xl border p-8 ${colors.border}`}>
          <div className="flex items-start gap-4">
            <div className="text-5xl">{brand.icon}</div>
            <div className="flex-1">
              <div className={`inline-block text-xs font-medium px-3 py-1 rounded-full border mb-3 ${colors.badge}`}>
                {brand.domain}
              </div>
              <h1 className="text-3xl font-bold text-slate-100 mb-2">{brand.name}</h1>
              <p className={`text-lg font-medium mb-3 ${colors.accent}`}>{brand.tagline}</p>
              <p className="text-slate-400 leading-relaxed max-w-2xl">{brand.description}</p>

              {/* Topics */}
              <div className="flex flex-wrap gap-2 mt-4">
                {brand.topics.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                    {t}
                  </span>
                ))}
              </div>

              <a
                href={brand.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-block mt-5 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors ${colors.button}`}
              >
                {brand.ctaText}
              </a>
            </div>
          </div>
        </header>

        {/* Author card */}
        <div className="flex items-center gap-4 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${colors.badge}`}>
            {brand.persona[0]}
          </div>
          <div>
            <div className="font-medium text-slate-200">{brand.persona}</div>
            <div className="text-xs text-slate-500 mt-0.5">{brand.role}</div>
          </div>
        </div>

        {/* Articles */}
        <section>
          <h2 className="text-xl font-bold text-slate-100 mb-5">
            Artículos {articles.length > 0 ? `(${articles.length})` : ""}
          </h2>

          {articles.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articulo/${article.slug}`}
                  className="block bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all hover:bg-slate-800/80 group"
                >
                  <div className="font-medium text-slate-200 group-hover:text-white leading-snug line-clamp-2 text-sm">
                    {article.title.replace("[GENERATING] ", "")}
                  </div>
                  <div className="text-xs text-slate-600 mt-2 font-mono">{article.keyword}</div>
                  <div className="text-xs text-slate-700 mt-1">
                    {new Date(article.created_at).toLocaleDateString("es-CO")}
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

        {/* Email capture */}
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
