import Link from "next/link";
import LeadCaptureForm from "@/components/LeadCaptureForm";

const SITE_ID = "d3920d22-2c34-40b1-9e8e-59142af08e2a";
const API_BASE = "https://web-production-c6ed5.up.railway.app";

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  summary?: string;
  category?: string;
  cluster?: string;
  word_count?: number;
  reading_time_minutes?: number;
  created_at?: string;
}

async function getArticles(): Promise<Article[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/content?site_id=${SITE_ID}&status=approved`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: Article[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
      ? data.data
      : [];
    return items.slice(0, 4);
  } catch {
    return [];
  }
}

function estimateReadTime(article: Article): number {
  if (article.reading_time_minutes) return article.reading_time_minutes;
  if (article.word_count) return Math.max(1, Math.round(article.word_count / 200));
  return 5;
}

function getExcerpt(article: Article): string {
  const raw = article.excerpt || article.summary || "";
  if (!raw) return "Una guía completa para ayudarte a tomar la mejor decisión de compra.";
  return raw.length > 130 ? raw.slice(0, 130).trimEnd() + "…" : raw;
}

// ─── STATIC GUIDE DATA ───────────────────────────────────────────────────────

const GUIDES = [
  {
    href: "/guia/dolor-espalda",
    category: "Salud del sueño",
    title: "¿Por qué me duele la espalda al despertar?",
    excerpt:
      "El colchón equivocado colapsa tu alineación lumbar en 7-8 horas. Aquí qué materiales aguantan el calor de Panamá Y dan soporte real.",
    featured: true,
    readTime: 8,
  },
  {
    href: "/guia/cada-cuanto-cambiar",
    category: "Mantenimiento",
    title: "¿Cada cuánto cambiar el colchón?",
    excerpt:
      "En clima tropical, los plazos de 8-10 años no aplican. La humedad acelera la degradación de espuma y resortes.",
    featured: false,
    readTime: 5,
  },
  {
    href: "/guia/materiales",
    category: "Materiales",
    title: "Grafeno, cobre, gel: lo que funciona vs marketing",
    excerpt:
      "Analizamos cada claim de temperatura de los fabricantes con datos reales. El resultado te sorprenderá.",
    featured: false,
    readTime: 6,
  },
  {
    href: "/guia/costo-real",
    category: "Economía del sueño",
    title: "¿El colchón barato es realmente más barato?",
    excerpt:
      "Calculamos costo por noche de 12 colchones en Panamá. El más caro resulta ser el más económico.",
    featured: false,
    readTime: 5,
  },
];

const RANKINGS = [
  {
    rank: 1,
    name: "NauralSleep Deep Sleep Hybrid",
    score: 9.2,
    type: "Híbrido",
    firmness: "Medio-firme",
    price: "$850–$1,100",
    costPerNight: "$0.28",
    badge: "Mejor general",
    badgeColor: "bg-gold-400 text-white",
    href: "/mejores",
  },
  {
    rank: 2,
    name: "NauralSleep Deep Sleep",
    score: 9.0,
    type: "Espuma",
    firmness: "Medio",
    price: "$650–$850",
    costPerNight: "$0.23",
    badge: "Mejor espuma",
    badgeColor: "bg-accent-500 text-white",
    href: "/mejores",
  },
  {
    rank: 3,
    name: "Simmons Beautyrest Harmony",
    score: 8.4,
    type: "Resortes ensacados",
    firmness: "Firme",
    price: "$700–$950",
    costPerNight: "$0.25",
    badge: "Mejor soporte",
    badgeColor: "bg-primary-400 text-white",
    href: "/mejores",
  },
];

const COMPARISON = [
  {
    brand: "NauralSleep",
    trial: "100 noches",
    warranty: "10 años",
    firmness: "3 opciones",
    shipping: "Gratis, 3–5 días",
    contact: "WhatsApp",
  },
  {
    brand: "Simmons",
    trial: "30 noches",
    warranty: "10 años",
    firmness: "Sí, publicada",
    shipping: "Costo adicional",
    contact: "Tienda física",
  },
  {
    brand: "Serta",
    trial: "No",
    warranty: "10 años",
    firmness: "Sí, publicada",
    shipping: "Costo adicional",
    contact: "Tienda física",
  },
  {
    brand: "Indufoam",
    trial: "No",
    warranty: "5 años",
    firmness: "Limitada",
    shipping: "Gratis en ciudad",
    contact: "Teléfono",
  },
];

const METHODOLOGY = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    title: "Alivio de presión",
    body: "Medimos puntos de presión en hombros, caderas y rodillas con simulación de posición lateral y dorsal.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Soporte lumbar",
    body: "Verificamos alineación espinal en 3 posiciones. Especial énfasis en soporte para el calor de Panamá (>28°C).",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    title: "Temperatura",
    body: "Testamos regulación térmica con humedad relativa de 80% — condición base en Panamá. Los claims de 'gel frío' se prueban aquí.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Durabilidad",
    body: "Proyectamos vida útil según densidad de espuma y calibre de resortes. Calculamos costo real por noche en 8 años.",
  },
];

// ─── SCORE RING ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const circumference = 2 * Math.PI * 20;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#e8e4f3" strokeWidth="4" />
        <circle
          cx="24" cy="24" r="20" fill="none"
          stroke="#8B7FB5" strokeWidth="4"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-sans font-bold text-sm text-primary-600">
        {score}
      </span>
    </div>
  );
}

export default async function HomePage() {
  const articles = await getArticles();

  // Merge API articles into guide slots (if available)
  const guidesToShow = articles.length > 0
    ? articles.slice(0, 4).map((a, i) => ({
        href: `/blog/${a.slug}`,
        category: a.category || a.cluster || GUIDES[i]?.category || "Guía",
        title: a.title,
        excerpt: getExcerpt(a),
        featured: i === 0,
        readTime: estimateReadTime(a),
      }))
    : GUIDES;

  const featuredGuide = guidesToShow[0];
  const otherGuides = guidesToShow.slice(1, 4);

  return (
    <>
      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-600">
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-accent-500/10 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gold-400/10 pointer-events-none" />

        {/* Thin gold top bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent opacity-70" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-gold-400/40 bg-gold-400/10">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
            <span className="font-sans text-xs font-semibold text-gold-300 tracking-wider uppercase">
              La guía #1 de colchones en Panamá
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] mb-6 max-w-4xl mx-auto">
            Encuentra el colchón correcto para tu{" "}
            <span className="italic text-gold-400">cuerpo</span> y tu{" "}
            <span className="italic text-gold-400">clima</span>
          </h1>

          {/* Trust line */}
          <p className="font-sans text-sm md:text-base text-primary-200 mb-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5">
              <span className="text-gold-400">◆</span> Evaluaciones independientes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-gold-400">◆</span> Datos ajustados al clima de Panamá
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-gold-400">◆</span> Sin marcas patrocinadas
            </span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold-400 hover:bg-gold-300 text-primary-700 font-sans font-bold text-sm rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-black/20"
            >
              Hacer el quiz de sueño →
            </Link>
            <Link
              href="/mejores"
              className="inline-flex items-center gap-2 px-8 py-3.5 border-2 border-white/30 hover:border-white/60 text-white font-sans font-semibold text-sm rounded-xl transition-all hover:bg-white/5 hover:-translate-y-0.5"
            >
              Ver rankings 2026
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CREDIBILITY BAR ───────────────────────────────────────────────── */}
      <section className="bg-white border-b border-primary-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              "12 marcas analizadas",
              "500+ facts verificados",
              "8 criterios de evaluación",
              "80% humedad considerada",
              "Actualizado marzo 2026",
            ].map((stat) => (
              <div key={stat} className="flex items-center gap-2">
                <span className="text-accent-500 text-xs">●</span>
                <span className="font-sans text-xs font-medium text-primary-500">{stat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GUIDES GRID ───────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-accent-500" />
              <span className="font-sans text-xs font-semibold tracking-widest uppercase text-accent-600">
                Guías editoriales
              </span>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-600">
              Aprende antes de comprar
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Featured card */}
            {featuredGuide && (
              <Link
                href={featuredGuide.href}
                className="group relative bg-primary-600 rounded-2xl p-8 md:p-10 overflow-hidden hover:bg-primary-700 transition-colors flex flex-col lg:row-span-1"
              >
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent-500/10 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <span className="inline-block self-start mb-4 px-3 py-1 bg-gold-400/20 text-gold-300 font-sans text-xs font-semibold rounded-full border border-gold-400/30">
                  {featuredGuide.category}
                </span>
                <h3 className="font-serif text-2xl md:text-3xl font-bold text-white leading-snug mb-4 group-hover:text-gold-300 transition-colors">
                  {featuredGuide.title}
                </h3>
                <p className="font-sans text-sm text-primary-200 leading-relaxed flex-1 mb-6">
                  {featuredGuide.excerpt}
                </p>
                <div className="flex items-center gap-4">
                  <span className="font-sans text-xs text-primary-300">{featuredGuide.readTime} min de lectura</span>
                  <span className="font-sans text-sm font-semibold text-gold-400 group-hover:underline">
                    Leer guía →
                  </span>
                </div>
              </Link>
            )}

            {/* 3 regular cards */}
            <div className="flex flex-col gap-4">
              {otherGuides.map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href}
                  className="group bg-white rounded-2xl p-6 border border-primary-100 hover:border-accent-300 hover:shadow-md transition-all flex gap-5 items-start"
                >
                  <div className="flex-1 min-w-0">
                    <span className="inline-block mb-2 px-2.5 py-0.5 bg-accent-50 text-accent-600 font-sans text-xs font-semibold rounded-full border border-accent-200">
                      {guide.category}
                    </span>
                    <h3 className="font-serif text-base font-bold text-primary-600 leading-snug mb-1.5 group-hover:text-accent-600 transition-colors line-clamp-2">
                      {guide.title}
                    </h3>
                    <p className="font-sans text-xs text-primary-400 leading-relaxed line-clamp-2">
                      {guide.excerpt}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center self-center">
                    <svg className="w-5 h-5 text-accent-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/blog" className="font-sans text-sm font-semibold text-accent-600 hover:underline">
              Ver todas las guías →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── QUIZ BANNER ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-600 py-20 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gold-400 mb-4">
            Herramienta gratuita
          </p>
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            ¿Cuál colchón necesita tu cuerpo?
          </h2>
          <p className="font-sans text-base text-primary-200 mb-10 max-w-xl mx-auto">
            4 pasos. 3 minutos. Te decimos exactamente qué tipo de colchón, firmeza y material es ideal para tu posición al dormir y el calor de Panamá.
          </p>

          {/* 4-step visual */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10 flex-wrap">
            {["Tu postura", "Tu peso", "Tu clima", "Tu recomendación"].map((step, i) => (
              <div key={step} className="flex items-center gap-2 sm:gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center font-sans text-xs font-bold text-white">
                    {i + 1}
                  </div>
                  <span className="font-sans text-xs text-primary-200 whitespace-nowrap">{step}</span>
                </div>
                {i < 3 && (
                  <svg className="w-4 h-4 text-white/30 flex-shrink-0 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <Link
            href="/quiz"
            className="inline-flex items-center gap-2 px-10 py-4 bg-gold-400 hover:bg-gold-300 text-primary-700 font-sans font-bold text-base rounded-xl shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Empezar quiz gratis →
          </Link>
          <p className="mt-4 font-sans text-xs text-primary-300">
            Sin registro · Sin correo · 100% gratis
          </p>
        </div>
      </section>

      {/* ─── METHODOLOGY ───────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-accent-500" />
              <span className="font-sans text-xs font-semibold tracking-widest uppercase text-accent-600">
                Cómo evaluamos
              </span>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-600 mb-4">
              Metodología transparente
            </h2>
            <p className="font-sans text-sm text-primary-400 leading-relaxed">
              Todos los colchones son evaluados con los mismos 8 criterios. Los datos de temperatura se toman con humedad relativa de 80% — condición típica en Ciudad de Panamá.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {METHODOLOGY.map((item) => (
              <div
                key={item.title}
                className="bg-primary-50 rounded-2xl p-6 border border-primary-100 hover:border-accent-300 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-accent-500/10 flex items-center justify-center text-accent-500 mb-4">
                  {item.icon}
                </div>
                <h3 className="font-serif text-lg font-bold text-primary-600 mb-2">{item.title}</h3>
                <p className="font-sans text-sm text-primary-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link href="/sobre#metodologia" className="font-sans text-sm font-semibold text-accent-600 hover:underline">
              Leer metodología completa →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── RANKINGS ──────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="h-px w-6 bg-accent-500" />
                <span className="font-sans text-xs font-semibold tracking-widest uppercase text-accent-600">
                  Rankings 2026
                </span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-600">
                Los mejores colchones en Panamá
              </h2>
            </div>
            <Link href="/mejores" className="font-sans text-sm font-semibold text-accent-600 hover:underline flex-shrink-0">
              Ver ranking completo →
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {RANKINGS.map((item) => (
              <Link
                key={item.rank}
                href={item.href}
                className="group bg-white rounded-2xl border border-primary-100 hover:border-accent-300 hover:shadow-md transition-all overflow-hidden"
              >
                <div className="flex items-center gap-5 p-5 sm:p-6">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 text-center font-serif font-bold text-2xl text-primary-300">
                    {item.rank}
                  </div>

                  {/* Score ring */}
                  <ScoreRing score={item.score} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-serif text-base sm:text-lg font-bold text-primary-600 group-hover:text-accent-600 transition-colors">
                        {item.name}
                      </h3>
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="font-sans text-xs text-primary-400">{item.type}</span>
                      <span className="font-sans text-xs text-primary-400">{item.firmness}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="hidden sm:block flex-shrink-0 text-right">
                    <div className="font-sans font-bold text-primary-600 text-sm">{item.price}</div>
                    <div className="font-sans text-xs text-primary-400">{item.costPerNight}/noche</div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-primary-300 group-hover:text-accent-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ──────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-accent-500" />
              <span className="font-sans text-xs font-semibold tracking-widest uppercase text-accent-600">
                Comparador
              </span>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-600">
              Las marcas cara a cara
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-primary-100 shadow-sm">
            <table className="w-full font-sans text-sm">
              <thead>
                <tr className="bg-primary-600 text-white">
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider rounded-tl-2xl">
                    Marca
                  </th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Prueba en casa</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Garantía</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Firmeza publicada</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Envío</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider rounded-tr-2xl">Contacto</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.brand} className={i % 2 === 0 ? "bg-white" : "bg-primary-50/50"}>
                    <td className="px-5 py-4 font-bold text-primary-600">{row.brand}</td>
                    <td className="px-5 py-4 text-primary-500">{row.trial}</td>
                    <td className="px-5 py-4 text-primary-500">{row.warranty}</td>
                    <td className="px-5 py-4 text-primary-500">{row.firmness}</td>
                    <td className="px-5 py-4 text-primary-500">{row.shipping}</td>
                    <td className="px-5 py-4 text-primary-500">{row.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 font-sans text-xs text-primary-400">
            Datos actualizados en marzo 2026. Las condiciones pueden variar — verifica con el vendedor antes de comprar.
          </p>
        </div>
      </section>

      {/* ─── NEWSLETTER ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-600 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-accent-500/10" />
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-gold-400/10" />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="h-px w-6 bg-gold-400/50" />
            <span className="font-sans text-xs font-semibold uppercase tracking-widest text-gold-400">
              Newsletter
            </span>
            <span className="h-px w-6 bg-gold-400/50" />
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-3">
            Consejos de sueño para Panamá
          </h2>
          <p className="font-sans text-sm text-primary-200 mb-10">
            Guías actualizadas, comparativas honestas y alertas de precios. Una vez a la semana. Sin spam.
          </p>
          <LeadCaptureForm
            headline=""
            subheadline=""
            ctaText="Suscribirme gratis →"
            ctaVariant="homepage-newsletter"
            showName={false}
            dark={true}
          />
        </div>
      </section>
    </>
  );
}
