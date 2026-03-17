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
function extractHeadings(md: string) {
  const headings: { id: string; text: string; level: number }[] = [];
  const lines = md.split("\n");
  for (const line of lines) {
    const m2 = line.match(/^## (.+)$/);
    const m3 = line.match(/^### (.+)$/);
    if (m2) {
      const text = m2[1].trim();
      headings.push({ id: slugifyId(text), text, level: 2 });
    } else if (m3) {
      const text = m3[1].trim();
      headings.push({ id: slugifyId(text), text, level: 3 });
    }
  }
  return headings;
}

function slugifyId(text: string) {
  return text.toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

function addHeadingIds(html: string) {
  return html.replace(/<h([23])>(.*?)<\/h\1>/gi, (_, level, text) => {
    const id = slugifyId(text.replace(/<[^>]+>/g, ""));
    return `<h${level} id="${id}">${text}</h${level}>`;
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

function extractLead(html: string): { lead: string; rest: string } {
  const m = html.match(/^<p>([\s\S]*?)<\/p>([\s\S]*)$/);
  if (m) return { lead: m[1], rest: m[2] };
  return { lead: "", rest: html };
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
  const htmlWithIds = addHeadingIds(rawHtml);
  const { lead, rest } = extractLead(htmlWithIds);
  const headings = extractHeadings(article.body_md || "");

  // Related articles
  let related: Awaited<ReturnType<typeof api.relatedContent>> = [];
  try {
    const all = await api.relatedContent(20);
    related = all.filter((a) => a.slug !== slug).slice(0, 4);
  } catch { related = []; }

  // Split article at roughly 40% for mid-article CTA
  const paragraphs = rest.split("</p>");
  const midPoint = Math.floor(paragraphs.length * 0.4);
  const firstHalf = paragraphs.slice(0, midPoint).join("</p>") + (midPoint < paragraphs.length ? "</p>" : "");
  const secondHalf = paragraphs.slice(midPoint).join("</p>");

  return (
    <>
      {/* Schema markup */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema(article, url)) }} />
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(article.title, slug)) }} />

      {/* Reading progress */}
      <Suspense fallback={null}><ReadingProgress /></Suspense>

      <div className="max-w-7xl mx-auto">
        {/* Hero section */}
        <div className="relative mb-10 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-green-950 border border-slate-700/50">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, #22c55e 0%, transparent 50%), radial-gradient(circle at 80% 20%, #065f46 0%, transparent 50%)"
          }} />
          <div className="relative px-8 py-12 max-w-3xl">
            <nav className="flex items-center gap-2 text-xs text-slate-500 mb-5 font-ui">
              <a href="/" className="hover:text-slate-300 transition-colors">Inicio</a>
              <span>›</span>
              <a href="/articulos" className="hover:text-slate-300 transition-colors">Artículos</a>
              <span>›</span>
              <span className="text-slate-400 line-clamp-1">{article.title}</span>
            </nav>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-slate-100 leading-tight mb-5" style={{ fontFamily: "var(--font-display)" }}>
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold font-ui shrink-0">C</div>
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

        {/* Content + Sidebar layout */}
        <div className="flex gap-10 items-start">
          {/* Main content */}
          <div className="flex-1 min-w-0 max-w-3xl">
            {/* Lead paragraph with schema itemprop */}
            {lead && (
              <p className="article-lead" itemProp="description" dangerouslySetInnerHTML={{ __html: lead }} />
            )}

            {/* First half of article */}
            <div
              className="article-body"
              dangerouslySetInnerHTML={{ __html: firstHalf }}
            />

            {/* Mid-article CTA */}
            <div className="my-10 p-6 bg-green-500/5 border-l-4 border-green-500 rounded-r-2xl">
              <div className="flex items-start gap-4">
                <div className="text-3xl">💡</div>
                <div>
                  <p className="text-sm font-semibold text-green-300 mb-1 font-ui">¿Quieres abrir tu cuenta en dólares?</p>
                  <p className="text-sm text-slate-400 mb-4">ikigii (Towerbank) es la opción más elegida por colombianos. Sin comisiones de mantenimiento. Aprobación en 24–72h.</p>
                  <a href="https://ikigii.com" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors font-ui">
                    Abrir cuenta ikigii →
                  </a>
                </div>
              </div>
            </div>

            {/* Second half */}
            <div className="article-body" dangerouslySetInnerHTML={{ __html: secondHalf }} />

            {/* Mid-article email capture */}
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

            {/* FAQ */}
            {faqs.length > 0 && (
              <section className="mt-10 mb-8">
                <h2 className="font-display text-xl font-bold text-slate-100 mb-6" style={{ fontFamily: "var(--font-display)" }}>
                  Preguntas frecuentes
                </h2>
                <div className="space-y-3">
                  {faqs.map((faq, i) => (
                    <details key={i} className="group bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-slate-200 hover:text-white list-none font-ui">
                        {faq.question}
                        <span className="ml-4 shrink-0 text-slate-500 group-open:rotate-180 transition-transform">▾</span>
                      </summary>
                      <p className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-700/50 pt-3" style={{ fontFamily: "var(--font-body)" }}>
                        {faq.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Author box */}
            <div className="border border-slate-700/50 rounded-2xl p-6 mt-10 bg-slate-800/30 flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-600/20 border border-green-500/30 flex items-center justify-center text-green-400 font-bold text-xl shrink-0 font-display" style={{ fontFamily: "var(--font-display)" }}>
                C
              </div>
              <div>
                <div className="font-semibold text-slate-200 font-ui">{AUTHOR}</div>
                <div className="text-xs text-green-400 font-ui mb-2">Especialista en Finanzas Internacionales</div>
                <p className="text-sm text-slate-400 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                  10+ años ayudando a colombianos a acceder al sistema financiero global. Vive entre Bogotá y Ciudad de Panamá.
                </p>
              </div>
            </div>

            {/* Related articles */}
            {related.length > 0 && (
              <section className="mt-12 pt-8 border-t border-slate-800">
                <h2 className="font-display text-lg font-bold text-slate-200 mb-4" style={{ fontFamily: "var(--font-display)" }}>
                  También te puede interesar
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {related.map((r) => (
                    <a key={r.id} href={`/articulo/${r.slug}`}
                      className="block bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-green-500/30 transition-all hover:bg-slate-800/80 group">
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
                origenUrl={url} temaInteres={article.keyword} intentScore={7}
                headline="¿Te fue útil este artículo?"
                subheadline="Únete a +5,000 colombianos que reciben guías financieras cada semana."
                ctaText="Suscribirme →"
              />
            </div>
          </div>

          {/* Sticky sidebar (desktop only) */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 space-y-8">
              {headings.length >= 3 && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                  <Suspense fallback={null}>
                    <TableOfContents headings={headings} />
                  </Suspense>
                </div>
              )}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                <Suspense fallback={null}>
                  <SocialShare url={url} title={article.title} />
                </Suspense>
              </div>
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wide font-ui mb-2">Cuenta en dólares</p>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                  Abre tu cuenta en USD desde Colombia. Sin viajar. Sin mínimo.
                </p>
                <a href="https://ikigii.com" target="_blank" rel="noopener noreferrer"
                  className="block text-center bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors font-ui">
                  Abrir cuenta ikigii →
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
