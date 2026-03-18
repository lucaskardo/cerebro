"use client";

// NOTE: Metadata cannot be exported from a Client Component.
// SEO metadata for this page is handled by the root layout.tsx.
// Intended metadata:
//   title: "Guías y Artículos — Blog de ColchonesPanamá"
//   description: "Artículos sobre colchones, sueño y salud. Guías de compra, comparativas y consejos de expertos para Panamá."

import { useEffect, useState } from "react";
import Link from "next/link";

const SITE_ID = "d3920d22-2c34-40b1-9e8e-59142af08e2a";
const API_URL = `https://web-production-c6ed5.up.railway.app/api/content?site_id=${SITE_ID}&status=approved`;
const PAGE_SIZE = 6;

interface Article {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  keyword: string;
  body_md?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readTime(article: Article): number {
  const text = [article.title, article.meta_description, article.body_md ?? ""].join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function extractCategory(article: Article): string {
  if (article.category && article.category.trim()) return article.category.trim();
  // Infer from keyword as fallback
  const kw = (article.keyword ?? "").toLowerCase();
  if (kw.includes("mejor") || kw.includes("top")) return "Comparativas";
  if (kw.includes("guía") || kw.includes("guia") || kw.includes("cómo") || kw.includes("como"))
    return "Guías de compra";
  if (kw.includes("salud") || kw.includes("dormir") || kw.includes("sueño"))
    return "Salud del sueño";
  if (kw.includes("opinión") || kw.includes("opinion") || kw.includes("review"))
    return "Opiniones";
  return "Consejos";
}

const ALL_LABEL = "Todos";

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1f2a] overflow-hidden animate-pulse">
      {/* Category badge */}
      <div className="p-5 pb-0">
        <div className="h-5 w-24 rounded-full bg-gray-200 dark:bg-gray-700 mb-4" />
      </div>
      <div className="p-5 pt-2 space-y-3">
        {/* Title */}
        <div className="space-y-2">
          <div className="h-5 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-5 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        {/* Excerpt */}
        <div className="space-y-2 pt-1">
          <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        {/* Meta */}
        <div className="flex gap-3 pt-2">
          <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        {/* CTA */}
        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 mt-3" />
      </div>
    </div>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article, index }: { article: Article; index: number }) {
  const category = extractCategory(article);
  const mins = readTime(article);
  const date = formatDate(article.created_at);
  const href = `/blog/${article.slug}`;

  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1f2a]
                 overflow-hidden transition-all duration-300
                 hover:shadow-[0_8px_30px_rgba(13,148,136,0.15)] hover:border-[#0d9488]
                 hover:-translate-y-0.5
                 fade-in-card"
      style={{ animationDelay: `${index * 60}ms` }}
      aria-label={`Leer artículo: ${article.title}`}
    >
      {/* Category badge */}
      <div className="px-5 pt-5">
        <span
          className="inline-block text-xs font-semibold uppercase tracking-wider
                     bg-[#0d9488]/10 text-[#0d9488] dark:bg-[#0d9488]/20 dark:text-teal-300
                     rounded-full px-3 py-1"
        >
          {category}
        </span>
      </div>

      {/* Content */}
      <div className="p-5 pt-3 flex flex-col gap-3">
        {/* Title */}
        <h2
          className="font-serif text-xl font-bold leading-snug text-[#1a1f36] dark:text-[#e8e6e1]
                     line-clamp-2 group-hover:text-[#0d9488] transition-colors duration-200"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {article.title}
        </h2>

        {/* Excerpt */}
        {article.meta_description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
            {article.meta_description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 opacity-60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {mins} min lectura
          </span>
          <span aria-hidden="true">·</span>
          <span>{date}</span>
        </div>

        {/* CTA */}
        <div
          className="text-sm font-semibold text-[#0d9488] dark:text-teal-400
                     flex items-center gap-1 mt-1
                     group-hover:gap-2 transition-all duration-200"
        >
          Leer artículo
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Category Pill ────────────────────────────────────────────────────────────

function CategoryPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`
        inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
        border transition-all duration-200 whitespace-nowrap
        ${
          active
            ? "bg-[#0d9488] border-[#0d9488] text-white shadow-md shadow-teal-500/20"
            : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#0d9488] hover:text-[#0d9488] dark:hover:text-teal-400"
        }
      `}
    >
      {label}
      <span
        className={`
          text-xs rounded-full px-1.5 py-0.5 font-semibold tabular-nums
          ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}
        `}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_LABEL);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Fetch articles on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchArticles() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(API_URL, { next: { revalidate: 0 } } as RequestInit);
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (!cancelled) {
          // API may return { items: [...] } or a plain array
          const list: Article[] = Array.isArray(data) ? data : (data.items ?? data.content ?? []);
          setArticles(list);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[BlogPage] fetch failed:", err);
          setError("No pudimos cargar los artículos. Por favor intenta de nuevo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchArticles();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory]);

  // Derive categories
  const categoryMap = new Map<string, number>();
  for (const article of articles) {
    const cat = extractCategory(article);
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }
  const categories = [ALL_LABEL, ...Array.from(categoryMap.keys()).sort()];

  // Filter articles
  const filtered =
    activeCategory === ALL_LABEL
      ? articles
      : articles.filter((a) => extractCategory(a) === activeCategory);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const categoryCount = (label: string) =>
    label === ALL_LABEL ? articles.length : (categoryMap.get(label) ?? 0);

  return (
    <>
      {/* Inline keyframe animation — avoids global CSS dependency */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in-card {
          opacity: 0;
          animation: fadeInUp 0.4s ease forwards;
        }
      `}</style>

      <div className="min-h-screen bg-[#fafaf8] dark:bg-[#111318]">
        {/* ── Hero Header ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-gray-100 dark:border-gray-800">
          {/* Subtle background accent */}
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, #0d9488, transparent)",
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="max-w-2xl">
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-5">
                <span className="h-px w-8 bg-[#0d9488]" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#0d9488]">
                  Blog
                </span>
              </div>

              {/* Headline */}
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight
                           text-[#1a1f36] dark:text-[#e8e6e1] mb-4"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Guías y Artículos
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                Contenido basado en evidencia para ayudarte a dormir mejor
              </p>

              {/* Article count badge */}
              {!loading && articles.length > 0 && (
                <div className="inline-flex items-center gap-2 bg-white dark:bg-[#1c1f2a] border border-gray-100 dark:border-gray-800 rounded-full px-4 py-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#0d9488] animate-pulse" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {articles.length} {articles.length === 1 ? "artículo publicado" : "artículos publicados"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

          {/* ── Category Filter Pills ───────────────────────────────────── */}
          {!loading && articles.length > 0 && (
            <div className="mb-10">
              <div
                className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1
                           scrollbar-hide sm:flex-wrap"
                role="group"
                aria-label="Filtrar por categoría"
              >
                {categories.map((cat) => (
                  <CategoryPill
                    key={cat}
                    label={cat}
                    active={activeCategory === cat}
                    count={categoryCount(cat)}
                    onClick={() => setActiveCategory(cat)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Loading Skeletons ───────────────────────────────────────── */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* ── Error State ─────────────────────────────────────────────── */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="text-5xl" aria-hidden="true">⚠️</div>
              <p className="text-gray-500 dark:text-gray-400 text-lg max-w-md">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-6 py-2.5 rounded-full bg-[#0d9488] text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {/* ── Empty State ─────────────────────────────────────────────── */}
          {!loading && !error && articles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div
                className="w-16 h-16 rounded-full bg-[#0d9488]/10 flex items-center justify-center"
                aria-hidden="true"
              >
                <svg
                  className="w-8 h-8 text-[#0d9488]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h2
                className="text-xl font-bold text-[#1a1f36] dark:text-[#e8e6e1]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Próximamente
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Estamos preparando guías y artículos sobre colchones. ¡Vuelve pronto!
              </p>
            </div>
          )}

          {/* ── No Results for Filter ────────────────────────────────────── */}
          {!loading && !error && articles.length > 0 && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <p className="text-gray-500 dark:text-gray-400">
                No hay artículos en la categoría{" "}
                <span className="font-semibold text-[#0d9488]">&ldquo;{activeCategory}&rdquo;</span> todavía.
              </p>
              <button
                onClick={() => setActiveCategory(ALL_LABEL)}
                className="text-sm font-semibold text-[#0d9488] hover:underline"
              >
                Ver todos los artículos
              </button>
            </div>
          )}

          {/* ── Article Grid ─────────────────────────────────────────────── */}
          {!loading && !error && visible.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visible.map((article, i) => (
                  <ArticleCard key={article.id} article={article} index={i} />
                ))}
              </div>

              {/* ── Load More ────────────────────────────────────────────── */}
              {hasMore && (
                <div className="flex justify-center mt-12">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="group inline-flex items-center gap-2 px-8 py-3 rounded-full
                               border-2 border-[#0d9488] text-[#0d9488] dark:text-teal-400
                               font-semibold text-sm
                               hover:bg-[#0d9488] hover:text-white dark:hover:text-white
                               transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Cargar más artículos
                    <svg
                      className="w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Shown count */}
              {!hasMore && filtered.length > PAGE_SIZE && (
                <p className="text-center text-sm text-gray-400 dark:text-gray-600 mt-10">
                  Mostrando los {filtered.length} artículos disponibles
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
