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
    return items.slice(0, 6);
  } catch {
    return [];
  }
}

function estimateReadTime(article: Article): number {
  if (article.reading_time_minutes) return article.reading_time_minutes;
  if (article.word_count) return Math.max(1, Math.round(article.word_count / 200));
  return 4;
}

function getExcerpt(article: Article): string {
  const raw = article.excerpt || article.summary || "";
  if (!raw) return "Una guía completa para ayudarte a tomar la mejor decisión.";
  return raw.length > 120 ? raw.slice(0, 120).trimEnd() + "…" : raw;
}

function getCategory(article: Article): string {
  return article.category || article.cluster || "Guía";
}

// Abstract wave SVG for hero background
function WaveSVG() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#1a1f36" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="waveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d4a853" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,160 C240,240 480,80 720,160 C960,240 1200,80 1440,160 L1440,560 L0,560 Z"
        fill="url(#waveGrad1)"
      />
      <path
        d="M0,280 C300,200 600,360 900,280 C1100,220 1280,320 1440,260 L1440,560 L0,560 Z"
        fill="url(#waveGrad2)"
        opacity="0.5"
      />
      <path
        d="M0,400 C180,340 400,460 720,400 C1020,340 1260,440 1440,380 L1440,560 L0,560 Z"
        fill="#0d9488"
        opacity="0.08"
      />
      <circle cx="200" cy="120" r="180" fill="#0d9488" opacity="0.05" />
      <circle cx="1300" cy="200" r="220" fill="#d4a853" opacity="0.04" />
      <circle cx="720" cy="440" r="260" fill="#0d9488" opacity="0.04" />
    </svg>
  );
}

// Icons for featured cards
function BookIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}

function SpineIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// Skeleton card for articles
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl overflow-hidden shadow-sm border border-primary-100 dark:border-primary-800 animate-pulse">
      <div className="h-2 bg-accent-200 dark:bg-accent-900 w-full" />
      <div className="p-6 space-y-3">
        <div className="h-4 bg-primary-100 dark:bg-primary-800 rounded w-1/4" />
        <div className="h-6 bg-primary-100 dark:bg-primary-800 rounded w-3/4" />
        <div className="h-4 bg-primary-50 dark:bg-primary-900 rounded w-full" />
        <div className="h-4 bg-primary-50 dark:bg-primary-900 rounded w-5/6" />
        <div className="h-4 bg-primary-50 dark:bg-primary-900 rounded w-1/3 mt-4" />
      </div>
    </div>
  );
}

const FEATURED_CARDS = [
  {
    icon: <BookIcon />,
    title: "Mejores Colchones en Panamá 2026",
    description:
      "Comparativa actualizada de los 12 colchones más vendidos en Panamá. Precios, materiales y veredicto honesto para cada presupuesto.",
    href: "/mejores",
    label: "Comparativa",
  },
  {
    icon: <QuizIcon />,
    title: "Quiz: ¿Cuál es tu colchón ideal?",
    description:
      "7 preguntas sobre tu posición al dormir, peso y preferencias. Te decimos exactamente qué tipo de colchón necesitas.",
    href: "/quiz",
    label: "Herramienta",
  },
  {
    icon: <SpineIcon />,
    title: "Dolor de Espalda: Soluciones Reales",
    description:
      "Cómo elegir el soporte lumbar correcto, qué materiales evitar y qué colchones recomiendan los fisioterapeutas panameños.",
    href: "/blog",
    label: "Salud",
  },
];

export default async function HomePage() {
  const articles = await getArticles();
  const hasArticles = articles.length > 0;

  return (
    <>
      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1020 0%, #1a1f36 50%, #0f2827 100%)" }}
      >
        <WaveSVG />

        {/* Gold accent bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent opacity-60" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-40">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="h-px w-8 bg-accent-400" />
              <span className="text-accent-400 font-sans text-sm font-medium tracking-widest uppercase">
                Guía independiente · Panamá
              </span>
            </div>

            {/* Main headline */}
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-6">
              Encuentra tu{" "}
              <span className="text-accent-400">colchón ideal</span>{" "}
              en Panamá
            </h1>

            {/* Subtitle */}
            <p className="font-sans text-lg md:text-xl text-primary-200 leading-relaxed mb-10 max-w-2xl">
              Guías imparciales, comparativas honestas y herramientas para
              dormir mejor — sin publicidad encubierta ni patrocinios.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/quiz"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent-600 hover:bg-accent-500 text-white font-sans font-semibold text-base rounded-xl transition-all duration-200 shadow-lg shadow-accent-900/40 hover:shadow-accent-900/60 hover:-translate-y-0.5"
              >
                Hacer el Quiz →
              </Link>
              <Link
                href="/mejores"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 hover:border-white/60 text-white font-sans font-semibold text-base rounded-xl transition-all duration-200 hover:bg-white/5 hover:-translate-y-0.5"
              >
                Ver Mejores Colchones
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-bg-light dark:from-bg-dark to-transparent" />
      </section>

      {/* ─── TRUST BAR ────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-card-dark border-y border-primary-100 dark:border-primary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-sans">
            {[
              { icon: "◈", text: "12+ colchones evaluados" },
              { icon: "◈", text: "Metodología transparente" },
              { icon: "◈", text: "Sin patrocinios" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-text-light dark:text-text-dark">
                <span className="text-accent-600 dark:text-accent-400 font-bold">{icon}</span>
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LO MÁS BUSCADO ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-bg-light dark:bg-bg-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="h-px w-6 bg-accent-500" />
              <span className="text-accent-600 dark:text-accent-400 font-sans text-xs font-semibold tracking-widest uppercase">
                Recursos destacados
              </span>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-light dark:text-text-dark">
              Lo más buscado
            </h2>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {FEATURED_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative bg-white dark:bg-card-dark rounded-2xl p-7 shadow-sm border border-primary-100 dark:border-primary-800 hover:shadow-md hover:border-accent-300 dark:hover:border-accent-700 transition-all duration-200 hover:-translate-y-1 flex flex-col"
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-accent-500 to-accent-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                {/* Label badge */}
                <span className="inline-block self-start mb-4 px-2.5 py-1 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 font-sans text-xs font-semibold rounded-full border border-accent-200 dark:border-accent-800">
                  {card.label}
                </span>

                {/* Icon */}
                <div className="mb-4 text-accent-600 dark:text-accent-400 group-hover:text-accent-500 transition-colors">
                  {card.icon}
                </div>

                {/* Title */}
                <h3 className="font-serif text-xl font-bold text-text-light dark:text-text-dark mb-3 leading-snug group-hover:text-accent-700 dark:group-hover:text-accent-400 transition-colors">
                  {card.title}
                </h3>

                {/* Description */}
                <p className="font-sans text-sm text-primary-500 dark:text-primary-300 leading-relaxed flex-1">
                  {card.description}
                </p>

                {/* CTA */}
                <div className="mt-5 pt-5 border-t border-primary-100 dark:border-primary-800">
                  <span className="font-sans text-sm font-semibold text-accent-600 dark:text-accent-400 group-hover:underline">
                    Leer más →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ARTÍCULOS RECIENTES ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-primary-50/50 dark:bg-primary-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="h-px w-6 bg-accent-500" />
                <span className="text-accent-600 dark:text-accent-400 font-sans text-xs font-semibold tracking-widest uppercase">
                  Publicaciones
                </span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-light dark:text-text-dark">
                Artículos recientes
              </h2>
            </div>
            <Link
              href="/blog"
              className="font-sans text-sm font-semibold text-accent-600 dark:text-accent-400 hover:underline flex-shrink-0"
            >
              Ver todos →
            </Link>
          </div>

          {/* Article grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {hasArticles
              ? articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/blog/${article.slug}`}
                    className="group bg-white dark:bg-card-dark rounded-2xl overflow-hidden shadow-sm border border-primary-100 dark:border-primary-800 hover:shadow-md hover:border-accent-300 dark:hover:border-accent-700 transition-all duration-200 hover:-translate-y-1 flex flex-col"
                  >
                    {/* Top category stripe */}
                    <div className="h-1 w-full bg-gradient-to-r from-accent-500 to-accent-400" />

                    <div className="p-6 flex flex-col flex-1">
                      {/* Category badge */}
                      <span className="inline-block self-start mb-4 px-2.5 py-1 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 font-sans text-xs font-semibold rounded-full border border-accent-200 dark:border-accent-800">
                        {getCategory(article)}
                      </span>

                      {/* Title */}
                      <h3 className="font-serif text-lg font-bold text-text-light dark:text-text-dark mb-3 leading-snug group-hover:text-accent-700 dark:group-hover:text-accent-400 transition-colors line-clamp-2">
                        {article.title}
                      </h3>

                      {/* Excerpt */}
                      <p className="font-sans text-sm text-primary-500 dark:text-primary-300 leading-relaxed flex-1 line-clamp-2">
                        {getExcerpt(article)}
                      </p>

                      {/* Meta */}
                      <div className="mt-5 pt-4 border-t border-primary-100 dark:border-primary-800 flex items-center justify-between">
                        <span className="font-sans text-xs text-primary-400 dark:text-primary-500">
                          <ClockIcon />
                          {estimateReadTime(article)} min de lectura
                        </span>
                        <span className="font-sans text-xs font-semibold text-accent-600 dark:text-accent-400 group-hover:underline">
                          Leer →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              : Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </section>

      {/* ─── QUIZ CTA ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "#0d9488" }}
      >
        {/* Subtle pattern overlay */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
          viewBox="0 0 800 300"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0,100 C200,60 400,140 600,100 C700,80 750,120 800,100 L800,300 L0,300 Z" fill="white" />
          <path d="M0,180 C150,140 350,220 550,180 C680,155 750,195 800,175 L800,300 L0,300 Z" fill="white" opacity="0.5" />
        </svg>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          {/* Star decoration */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 mb-8">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>

          <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
            ¿No sabes por dónde empezar?
          </h2>
          <p className="font-sans text-lg md:text-xl text-white/85 max-w-xl mx-auto mb-10 leading-relaxed">
            Responde 7 preguntas y te decimos qué colchón es ideal para ti —
            gratis, sin registro y sin correo electrónico.
          </p>
          <Link
            href="/quiz"
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-accent-700 font-sans font-bold text-base rounded-xl shadow-xl hover:bg-primary-50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Hacer el Quiz Gratis →
          </Link>

          {/* Social proof footnote */}
          <p className="mt-6 font-sans text-sm text-white/60">
            7 preguntas · &lt; 2 minutos · Sin registro
          </p>
        </div>
      </section>

      {/* ─── NEWSLETTER ───────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-bg-light dark:bg-bg-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="h-px w-6 bg-accent-500" />
                <span className="text-accent-600 dark:text-accent-400 font-sans text-xs font-semibold tracking-widest uppercase">
                  Newsletter
                </span>
                <span className="h-px w-6 bg-accent-500" />
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-light dark:text-text-dark mb-3">
                Duerme mejor, cada semana
              </h2>
              <p className="font-sans text-primary-500 dark:text-primary-300 text-base">
                Consejos prácticos y nuevas guías, sin publicidad encubierta.
              </p>
            </div>

            <LeadCaptureForm
              headline="Recibe consejos de sueño cada semana"
              subheadline="Guías imparciales y comparativas actualizadas, directamente en tu email. Sin spam, nunca."
              ctaText="Suscribirme gratis →"
              ctaVariant="homepage-newsletter"
              showName={false}
              dark={false}
            />
          </div>
        </div>
      </section>
    </>
  );
}
