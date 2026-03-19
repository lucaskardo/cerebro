import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import ReadingProgress from "@/components/ReadingProgress";
import TableOfContents from "@/components/TableOfContents";
import LeadCaptureForm from "@/components/LeadCaptureForm";

// ─── Constants ────────────────────────────────────────────────────────────────

const SITE_URL = "https://colchonespanama.com";
const API_BASE = "https://web-production-c6ed5.up.railway.app";
const SITE_ID = "d3920d22-2c34-40b1-9e8e-59142af08e2a";

const SPANISH_MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Article {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  keyword: string;
  body_md: string;
  body_html?: string;
  category?: string;
  status: string;
  created_at: string;
  updated_at: string;
  faq_section?: Array<{ question: string; answer: string }>;
}

// ─── Helper: slugify heading text to a valid id ───────────────────────────────

function slugifyId(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── Helper: extract headings from HTML ──────────────────────────────────────

function extractHeadings(html: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const regex = /<h([23])[^>]*>(.*?)<\/h[23]>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const rawText = match[2].replace(/<[^>]+>/g, "").trim();
    const idMatch = /id="([^"]+)"/.exec(match[0]);
    const id = idMatch ? idMatch[1] : slugifyId(rawText);
    if (rawText) headings.push({ id, text: rawText, level });
  }
  return headings;
}

// ─── Helper: inject id attributes into h2/h3 tags ────────────────────────────

function injectHeadingIds(html: string): string {
  // Track duplicates so ids remain unique
  const seen: Record<string, number> = {};

  return html.replace(/<h([23])([^>]*)>(.*?)<\/h[23]>/gi, (_, level, attrs, inner) => {
    // If there's already an id attribute, leave it alone
    if (/id="/i.test(attrs)) return `<h${level}${attrs}>${inner}</h${level}>`;
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let baseId = slugifyId(text);
    if (!baseId) baseId = `heading-${level}`;
    const count = seen[baseId] ?? 0;
    seen[baseId] = count + 1;
    const finalId = count === 0 ? baseId : `${baseId}-${count}`;
    return `<h${level}${attrs} id="${finalId}">${inner}</h${level}>`;
  });
}

// ─── Helper: minimal Markdown → HTML ─────────────────────────────────────────

function mdToHtml(md: string): string {
  let html = md;

  // Escape < and > outside code blocks (rudimentary — preserve existing HTML)
  // We'll trust the content not to have raw HTML that should stay raw.

  // Fenced code blocks  ```lang … ```
  html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  });

  // Inline code `…`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings (must come before bold/italic)
  html = html.replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold + italic ***…***
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold **…**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic *…*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Italic _…_
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Blockquotes
  html = html.replace(/^>\s?(.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr />");

  // Unordered lists — collect consecutive lines
  html = html.replace(/((?:^[-*+]\s.+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((l) => `<li>${l.replace(/^[-*+]\s/, "").trim()}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\.\s.+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((l) => `<li>${l.replace(/^\d+\.\s/, "").trim()}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');

  // Tables (simple)
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, (block) => {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return block;
    const isSeperator = (l: string) => /^\|[-|\s:]+\|$/.test(l.trim());
    const parseRow = (l: string, tag: string) =>
      `<tr>${l
        .split("|")
        .slice(1, -1)
        .map((c) => `<${tag}>${c.trim()}</${tag}>`)
        .join("")}</tr>`;

    const sepIdx = lines.findIndex(isSeperator);
    if (sepIdx < 0) return block;

    const headerLine = lines[0];
    const bodyLines = lines.slice(sepIdx + 1);
    return `<table><thead>${parseRow(headerLine, "th")}</thead><tbody>${bodyLines
      .map((l) => parseRow(l, "td"))
      .join("")}</tbody></table>`;
  });

  // Wrap orphan lines in <p> (lines not inside a block element)
  const blockTags = /^<(h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|img)/;
  const lines = html.split("\n");
  const wrapped: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      wrapped.push("");
      i++;
      continue;
    }
    if (blockTags.test(line) || line.startsWith("</")) {
      wrapped.push(line);
      i++;
      continue;
    }
    // Accumulate paragraph lines
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !blockTags.test(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    wrapped.push(`<p>${paraLines.join(" ")}</p>`);
  }
  return wrapped.join("\n");
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchArticle(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API_BASE}/api/content/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // API may return the article directly or wrapped
    return (data?.data ?? data) as Article;
  } catch {
    return null;
  }
}

async function fetchRelatedArticles(currentSlug: string): Promise<Article[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/content?site_id=${SITE_ID}&status=approved`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: Article[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : [];
    return items.filter((a) => a.slug !== currentSlug).slice(0, 3);
  } catch {
    return [];
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getUTCDate();
    const month = SPANISH_MONTHS[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} de ${month}, ${year}`;
  } catch {
    return iso;
  }
}

function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);

  if (!article) {
    return {
      title: "Artículo no encontrado | ColchonesPanamá",
      description: "El artículo que buscas no existe o fue eliminado.",
    };
  }

  const canonical = `${SITE_URL}/blog/${article.slug}`;
  const ogImage = `${SITE_URL}/og-default.jpg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description,
    author: {
      "@type": "Person",
      name: "Dra. Sofía Reyes",
      jobTitle: "Especialista en ergonomía del sueño",
    },
    publisher: {
      "@type": "Organization",
      name: "ColchonesPanamá",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    datePublished: article.created_at,
    dateModified: article.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    image: ogImage,
    keywords: article.keyword,
  };

  return {
    title: article.title,
    description: article.meta_description,
    keywords: [article.keyword, "colchones", "panamá", article.category ?? ""].filter(Boolean),
    alternates: { canonical },
    openGraph: {
      type: "article",
      locale: "es_PA",
      url: canonical,
      siteName: "ColchonesPanamá",
      title: article.title,
      description: article.meta_description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
      publishedTime: article.created_at,
      modifiedTime: article.updated_at,
      authors: ["Dra. Sofía Reyes"],
      section: article.category ?? "Guías de colchones",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.meta_description,
      images: [ogImage],
    },
    // JSON-LD injected inline in the page component; not here
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [article, relatedArticles] = await Promise.all([
    fetchArticle(slug),
    fetchRelatedArticles(slug),
  ]);

  if (!article) notFound();

  // Prepare body HTML
  const rawHtml = article.body_html ?? mdToHtml(article.body_md ?? "");
  const bodyHtml = injectHeadingIds(rawHtml);
  const headings = extractHeadings(bodyHtml);

  // Meta
  const dateStr = formatDate(article.created_at);
  const minutes = readingTime(article.body_md ?? article.body_html ?? "");
  const canonical = `${SITE_URL}/blog/${article.slug}`;

  // JSON-LD for page (also returned in metadata but some scenarios need it inline)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description,
    author: {
      "@type": "Person",
      name: "Dra. Sofía Reyes",
      jobTitle: "Especialista en ergonomía del sueño",
    },
    publisher: {
      "@type": "Organization",
      name: "ColchonesPanamá",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    datePublished: article.created_at,
    dateModified: article.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };

  // BreadcrumbList schema
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: article.title, item: canonical },
    ],
  };

  // FAQ schema (only when article has FAQ entries)
  const faqLd = article.faq_section && article.faq_section.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: article.faq_section.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  return (
    <>
      {/* JSON-LD — Article */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* JSON-LD — BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* JSON-LD — FAQPage (conditional) */}
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      {/* Reading progress bar (client component, wrapped in Suspense) */}
      <Suspense fallback={null}>
        <ReadingProgress />
      </Suspense>

      {/* ── Page shell ───────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
        {/* Hero band */}
        <div className="bg-primary-700 dark:bg-primary-900 py-10 px-4">
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Migas de pan" className="mb-6">
              <ol className="flex items-center gap-2 text-sm text-primary-200 flex-wrap">
                <li>
                  <Link href="/" className="hover:text-white transition-colors">
                    Inicio
                  </Link>
                </li>
                <li aria-hidden className="text-primary-400">/</li>
                <li>
                  <Link href="/blog" className="hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li aria-hidden className="text-primary-400">/</li>
                <li
                  className="text-white font-medium truncate max-w-[200px] sm:max-w-xs"
                  aria-current="page"
                >
                  {article.title}
                </li>
              </ol>
            </nav>

            {/* Category pill */}
            {article.category && (
              <span className="inline-block mb-4 px-3 py-1 bg-accent-600 text-white text-xs font-semibold uppercase tracking-wider rounded-full">
                {article.category}
              </span>
            )}

            {/* H1 */}
            <h1 className="font-serif font-bold text-4xl md:text-5xl text-white leading-tight mb-6 max-w-3xl">
              {article.title}
            </h1>

            {/* Meta row */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-full bg-accent-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                aria-hidden
              >
                S
              </div>
              <div className="text-sm">
                <p className="text-white font-semibold leading-tight">Dra. Sofía Reyes</p>
                <p className="text-primary-200 leading-tight">Especialista en ergonomía del sueño</p>
              </div>
              <span className="text-primary-400 hidden sm:block">·</span>
              <time
                dateTime={article.created_at}
                className="text-primary-200 text-sm capitalize"
              >
                {dateStr}
              </time>
              <span className="text-primary-400 hidden sm:block">·</span>
              <span className="text-primary-200 text-sm">{minutes} min de lectura</span>
            </div>
          </div>
        </div>

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-12 items-start">

            {/* ── Main content column ────────────────────────────────────── */}
            <div className="min-w-0">

              {/* Key takeaway box */}
              <div className="border-l-4 border-accent-600 bg-accent-50 dark:bg-accent-900/20 rounded-r-xl px-5 py-4 mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-accent-700 dark:text-accent-400 mb-2">
                  Puntos clave:
                </p>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {article.meta_description}
                </p>
              </div>

              {/* Article body */}
              <article
                className="article-body"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />

              {/* FAQ section */}
              {article.faq_section && article.faq_section.length > 0 && (
                <section className="mt-12" aria-labelledby="faq-heading">
                  <h2
                    id="faq-heading"
                    className="font-serif font-bold text-2xl text-primary-700 dark:text-text-dark mb-6 flex items-center gap-2"
                  >
                    <span className="text-accent-600">?</span>
                    Preguntas frecuentes
                  </h2>
                  <div className="space-y-3">
                    {article.faq_section.map((item, idx) => (
                      <details
                        key={idx}
                        className="group border border-gray-200 dark:border-primary-700 rounded-xl overflow-hidden"
                      >
                        <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none bg-white dark:bg-card-dark hover:bg-accent-50 dark:hover:bg-primary-800/40 transition-colors select-none">
                          <span className="font-semibold text-primary-700 dark:text-text-dark text-sm leading-snug">
                            {item.question}
                          </span>
                          {/* Chevron icon */}
                          <svg
                            className="w-5 h-5 text-accent-600 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-card-dark border-t border-gray-100 dark:border-primary-700">
                          {item.answer}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              )}

              {/* Author bio box */}
              <div className="mt-12 border border-gray-200 dark:border-primary-700 rounded-2xl p-6 bg-white dark:bg-card-dark flex gap-5">
                <div
                  className="w-16 h-16 rounded-full bg-accent-600 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                  aria-hidden
                >
                  S
                </div>
                <div>
                  <p className="font-serif font-bold text-lg text-primary-700 dark:text-text-dark mb-0.5">
                    Dra. Sofía Reyes
                  </p>
                  <p className="text-xs text-accent-600 dark:text-accent-400 font-semibold uppercase tracking-wider mb-3">
                    Especialista en ergonomía del sueño
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Fisioterapeuta con más de 12 años de experiencia en ergonomía postural y medicina
                    del sueño. Asesora clínicas y empresas en Panamá sobre higiene del sueño y
                    selección de superficies de descanso. Sus análisis combinan evidencia científica
                    con pruebas de campo independientes.
                  </p>
                </div>
              </div>

              {/* Lead capture form */}
              <div className="mt-10">
                <LeadCaptureForm
                  headline="¿Te sirvió esta guía?"
                  subheadline="Recibe más guías de colchones cada semana"
                  ctaVariant="article-bottom"
                  assetId={article.id}
                />
              </div>

              {/* Related articles */}
              {relatedArticles.length > 0 && (
                <section className="mt-12" aria-labelledby="related-heading">
                  <h2
                    id="related-heading"
                    className="font-serif font-bold text-2xl text-primary-700 dark:text-text-dark mb-6"
                  >
                    También puede interesarte
                  </h2>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {relatedArticles.map((rel) => (
                      <Link
                        key={rel.id}
                        href={`/blog/${rel.slug}`}
                        className="group block border border-gray-200 dark:border-primary-700 rounded-xl overflow-hidden bg-white dark:bg-card-dark hover:border-accent-400 dark:hover:border-accent-500 hover:shadow-md transition-all duration-200"
                      >
                        {/* Card accent bar */}
                        <div className="h-1.5 bg-gradient-to-r from-accent-600 to-gold-400" />
                        <div className="p-4">
                          {rel.category && (
                            <span className="text-xs font-semibold text-accent-600 dark:text-accent-400 uppercase tracking-wide">
                              {rel.category}
                            </span>
                          )}
                          <h3 className="font-serif font-semibold text-sm text-primary-700 dark:text-text-dark leading-snug mt-1 mb-2 group-hover:text-accent-700 dark:group-hover:text-accent-400 transition-colors line-clamp-3">
                            {rel.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                            {rel.meta_description}
                          </p>
                          <span className="mt-3 inline-block text-xs font-semibold text-accent-600 dark:text-accent-400 group-hover:underline">
                            Leer artículo →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── Sticky sidebar (desktop) ───────────────────────────────── */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">

                {/* Table of contents */}
                {headings.length > 0 && (
                  <div className="border border-gray-200 dark:border-primary-700 rounded-xl p-5 bg-white dark:bg-card-dark">
                    <Suspense fallback={null}>
                      <TableOfContents headings={headings} />
                    </Suspense>
                  </div>
                )}

                {/* Mini lead capture */}
                <div className="border border-accent-200 dark:border-accent-800 rounded-xl p-5 bg-accent-50 dark:bg-accent-900/20">
                  <p className="font-serif font-bold text-base text-primary-700 dark:text-text-dark mb-1">
                    Guías semanales
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Recibe comparativas y consejos de sueño directo en tu email.
                  </p>
                  <LeadCaptureForm
                    headline=""
                    subheadline=""
                    ctaText="Suscribirme →"
                    ctaVariant="sidebar"
                    assetId={article.id}
                  />
                </div>

                {/* Reading info badge */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-card-dark border border-gray-200 dark:border-primary-700 rounded-xl text-sm text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{minutes} min de lectura</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Back to top button (fixed) */}
      <BackToTop />
    </>
  );
}

// ─── BackToTop (client island would be ideal, but we keep this file as Server Component)
// We render it as a plain anchor targeting the page top via CSS/scroll-behavior: smooth.
// For a true button with JS, a separate client component would be needed; this approach
// works without JS via the smooth-scroll set in globals.css.

function BackToTop() {
  return (
    <a
      href="#top"
      aria-label="Volver arriba"
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-accent-600 hover:bg-accent-500 text-white flex items-center justify-center shadow-lg transition-colors text-lg font-bold"
      title="↑ Arriba"
    >
      ↑
    </a>
  );
}
