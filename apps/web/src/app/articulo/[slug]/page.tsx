import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import EmailCaptureForm from "@/components/EmailCaptureForm";
import ReadingProgress from "@/components/ReadingProgress";
import TableOfContents from "@/components/TableOfContents";
import SocialShare from "@/components/SocialShare";

const SITE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;
const AUTHOR = "Carlos Medina";

// ─── SEO Metadata ─────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const article = await api.contentBySlug(slug);
    const url = `${SITE_URL}/articulo/${slug}`;
    const ogImage = `${SITE_URL}/api/og?title=${encodeURIComponent(article.title)}&slug=${slug}`;
    return {
      title: `${article.title} | Dólar Afuera`,
      description: article.meta_description,
      alternates: { canonical: url },
      openGraph: {
        title: article.title,
        description: article.meta_description,
        url,
        type: "article",
        publishedTime: article.created_at,
        modifiedTime: article.updated_at,
        authors: [AUTHOR],
        siteName: "Dólar Afuera",
        images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.meta_description,
        images: [ogImage],
      },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: "Artículo | Dólar Afuera" };
  }
}

// ─── Schema helpers ────────────────────────────────────────────────────────────
function articleSchema(article: Awaited<ReturnType<typeof api.contentBySlug>>, url: string) {
  return {
    "@context": "https://schema.org", "@type": "Article",
    headline: article.title.substring(0, 110),
    description: article.meta_description,
    author: { "@type": "Person", name: AUTHOR, jobTitle: "Especialista en Finanzas Internacionales", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Dólar Afuera", url: SITE_URL },
    datePublished: article.created_at, dateModified: article.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "es-CO",
  };
}

function faqSchema(faqs: Array<{ question: string; answer: string }>) {
  if (!faqs?.length) return null;
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question", name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function breadcrumbSchema(title: string, slug: string) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Artículos", item: `${SITE_URL}/articulos` },
      { "@type": "ListItem", position: 3, name: title, item: `${SITE_URL}/articulo/${slug}` },
    ],
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function slugifyId(text: string) {
  return text.toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

function extractHeadings(html: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const level = parseInt(m[1], 10);
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    headings.push({ id: slugifyId(text), text, level });
  }
  return headings;
}

function injectHeadingIds(html: string): string {
  return html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const id = slugifyId(text);
    return `<h${level} id="${id}"${attrs || ""}>${inner}</h${level}>`;
  });
}

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>(?:\n<li>[\s\S]*?<\/li>)*)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

function splitAtMidpoint(html: string): { firstHalf: string; secondHalf: string } {
  const mid = Math.floor(html.length / 2);
  // Find all </p> and </h2> closing tag positions
  const closingTags = ["</p>", "</h2>"];
  let bestIdx = -1;
  let bestDist = Infinity;

  for (const tag of closingTags) {
    let searchFrom = 0;
    while (true) {
      const idx = html.indexOf(tag, searchFrom);
      if (idx === -1) break;
      const splitPos = idx + tag.length;
      const dist = Math.abs(splitPos - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = splitPos;
      }
      searchFrom = idx + 1;
    }
  }

  if (bestIdx === -1) {
    return { firstHalf: html, secondHalf: "" };
  }

  return {
    firstHalf: html.slice(0, bestIdx),
    secondHalf: html.slice(bestIdx),
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let article: Awaited<ReturnType<typeof api.contentBySlug>>;
  try {
    article = await api.contentBySlug(slug);
  } catch {
    return notFound();
  }

  const url = `${SITE_URL}/articulo/${slug}`;
  const faqs = article.faq_section ?? [];
  const readingTime = Math.ceil((article.body_md?.split(" ").length ?? 0) / 200);
  const rawHtml = article.body_html || mdToHtml(article.body_md || "");
  const htmlWithIds = injectHeadingIds(rawHtml);
  const headings = extractHeadings(htmlWithIds);
  const { firstHalf, secondHalf } = splitAtMidpoint(htmlWithIds);

  // Related articles
  let related: Awaited<ReturnType<typeof api.relatedContent>> = [];
  try {
    const all = await api.relatedContent(20);
    related = all.filter((a) => a.slug !== slug).slice(0, 4);
  } catch { related = []; }

  const proseClasses = [
    "prose prose-invert prose-slate max-w-none",
    "prose-headings:font-display prose-headings:text-slate-100",
    "prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:font-bold",
    "prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3",
    "prose-p:font-body prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-lg prose-p:mb-5",
    "prose-a:text-green-400 prose-a:no-underline hover:prose-a:underline",
    "prose-strong:text-slate-100",
    "prose-blockquote:border-green-500 prose-blockquote:text-slate-400",
    "prose-code:text-green-400 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
  ].join(" ");

  return (
    <>
      {/* Schema markup */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema(article, url)) }} />
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(article.title, slug)) }} />

      {/* Reading progress bar */}
      <Suspense fallback={null}><ReadingProgress /></Suspense>

      {/* Hero section */}
      <div className="article-hero bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-screen-xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6 font-ui" aria-label="Breadcrumb">
            <a href="/" className="hover:text-slate-300 transition-colors">Inicio</a>
            <span>›</span>
            <a href="/articulos" className="hover:text-slate-300 transition-colors">Artículos</a>
            <span>›</span>
            <span className="text-slate-400 line-clamp-1">{article.title}</span>
          </nav>

          {/* Title */}
          <h1
            className="font-display text-4xl md:text-5xl font-bold text-slate-100 leading-tight mb-5 max-w-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {article.title}
          </h1>

          {/* Lead / meta_description */}
          {article.meta_description && (
            <p
              className="text-xl text-slate-300 leading-relaxed mb-8 max-w-2xl"
              style={{ fontFamily: "var(--font-body)" }}
              itemProp="description"
            >
              {article.meta_description}
            </p>
          )}

          {/* Author / date / reading time row */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold font-ui shrink-0">
                C
              </div>
              <div>
                <div className="text-slate-200 font-medium font-ui text-sm">{AUTHOR}</div>
                <div className="text-slate-500 text-xs font-ui">Especialista en Finanzas</div>
              </div>
            </div>
            <span className="text-slate-700">·</span>
            <time dateTime={article.updated_at} className="text-slate-500 font-ui text-sm">
              {new Date(article.updated_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
            </time>
            {readingTime > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-amber-500 font-ui text-sm font-medium">{readingTime} min de lectura</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content area: 2-column split below hero */}
      <div className="max-w-screen-xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">

          {/* Left: article content */}
          <main>
            {/* First half of article */}
            <div
              className={proseClasses}
              dangerouslySetInnerHTML={{ __html: firstHalf }}
            />

            {/* Mid-article CTA box */}
            <div className="my-12 rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent p-7">
              <p className="font-ui text-xs font-semibold uppercase tracking-widest text-green-400 mb-2">Recurso gratuito</p>
              <p className="text-xl font-bold text-slate-100 mb-2">Descarga el comparativo completo de cuentas USD</p>
              <p className="text-slate-400 text-sm mb-5">
                Guía actualizada con los mejores bancos y fintechs para colombianos — fees reales, requisitos y paso a paso.
              </p>
              <a
                href="#email-capture"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors font-ui"
              >
                Recibe la guía gratis →
              </a>
            </div>

            {/* Second half of article */}
            <div
              className={proseClasses}
              dangerouslySetInnerHTML={{ __html: secondHalf }}
            />

            {/* FAQ section */}
            {faqs.length > 0 && (
              <section className="mt-12 mb-8">
                <h2
                  className="font-display text-2xl font-bold text-slate-100 mb-6"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Preguntas frecuentes
                </h2>
                <div className="space-y-3">
                  {faqs.map((faq, i) => (
                    <details key={i} className="group bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-slate-200 hover:text-white list-none font-ui">
                        {faq.question}
                        <span className="ml-4 shrink-0 text-slate-500 group-open:rotate-180 transition-transform">▾</span>
                      </summary>
                      <p
                        className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-700/50 pt-3"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {faq.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Email capture form */}
            <div className="my-10">
              <EmailCaptureForm
                origenUrl={url}
                temaInteres={article.keyword}
                intentScore={6}
                headline="Recibe más guías como esta"
                subheadline="Cada semana, las mejores estrategias financieras para colombianos en el exterior."
                ctaText="Suscribirme gratis →"
              />
            </div>

            {/* Author box */}
            <div className="border border-slate-700/50 rounded-2xl p-6 mt-10 bg-slate-800/30 flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-600/20 border border-green-500/30 flex items-center justify-center text-green-400 font-bold text-xl shrink-0 font-display"
                style={{ fontFamily: "var(--font-display)" }}
              >
                C
              </div>
              <div>
                <div className="font-semibold text-slate-200 font-ui">{AUTHOR}</div>
                <div className="text-xs text-green-400 font-ui mb-2">Especialista en Finanzas Internacionales</div>
                <p
                  className="text-sm text-slate-400 leading-relaxed"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  10+ años ayudando a colombianos a acceder al sistema financiero global. Vive entre Bogotá y Ciudad de Panamá.
                </p>
              </div>
            </div>

            {/* Related articles grid */}
            {related.length > 0 && (
              <section className="mt-12 pt-8 border-t border-slate-800">
                <h2
                  className="font-display text-lg font-bold text-slate-200 mb-4"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  También te puede interesar
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {related.map((r) => (
                    <a
                      key={r.id}
                      href={`/articulo/${r.slug}`}
                      className="block bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-green-500/30 transition-all hover:bg-slate-800/80 group"
                    >
                      <div className="text-sm font-medium text-slate-200 group-hover:text-white leading-snug line-clamp-2 font-ui">
                        {r.title}
                      </div>
                      <div className="text-xs text-slate-600 mt-2 font-mono">{r.keyword}</div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Bottom email capture */}
            <div className="mt-10">
              <EmailCaptureForm
                origenUrl={url}
                temaInteres={article.keyword}
                intentScore={7}
                headline="¿Te fue útil este artículo?"
                subheadline="Únete a +5,000 colombianos que reciben guías financieras cada semana."
                ctaText="Suscribirme →"
              />
            </div>
          </main>

          {/* Right: sticky sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              {/* TableOfContents */}
              {headings.length >= 3 && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                  <Suspense fallback={null}>
                    <TableOfContents headings={headings} />
                  </Suspense>
                </div>
              )}

              {/* SocialShare */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                <Suspense fallback={null}>
                  <SocialShare url={`${SITE_URL}/articulo/${slug}`} title={article.title} />
                </Suspense>
              </div>

              {/* Guía gratuita CTA card */}
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                <p className="font-ui text-xs font-semibold uppercase tracking-widest text-green-400 mb-3">Guía gratuita</p>
                <p className="font-bold text-slate-200 text-sm mb-1">Comparativo de cuentas USD</p>
                <p className="text-xs text-slate-400 mb-4">Las mejores opciones para colombianos — fees, requisitos y paso a paso.</p>
                <a
                  href="#email-capture"
                  className="block w-full text-center bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm py-2.5 rounded-xl transition-colors"
                >
                  Descargar gratis →
                </a>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </>
  );
}
