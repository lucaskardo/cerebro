import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import EmailCaptureForm from "@/components/EmailCaptureForm";

const SITE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;
// TODO: When content_assets.site_id is populated, fetch site's brand_persona as author
const AUTHOR = "Carlos Medina";

// ─── Metadata (SEO) ─────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const article = await api.contentBySlug(slug);
    const url = `${SITE_URL}/articulo/${slug}`;
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
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.meta_description,
      },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: "Artículo | Dólar Afuera" };
  }
}

// ─── Schema helpers ──────────────────────────────────────────────────────────
function articleSchema(article: Awaited<ReturnType<typeof api.contentBySlug>>) {
  const url = `${SITE_URL}/articulo/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title.substring(0, 110),
    description: article.meta_description,
    author: {
      "@type": "Person",
      name: AUTHOR,
      jobTitle: "Especialista en Finanzas Internacionales",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Dólar Afuera",
      url: SITE_URL,
    },
    datePublished: article.created_at,
    dateModified: article.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "es-CO",
  };
}

function faqSchema(faqs: Array<{ question: string; answer: string }>) {
  if (!faqs?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function breadcrumbSchema(title: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Artículos", item: `${SITE_URL}/articulos` },
      { "@type": "ListItem", position: 3, name: title, item: `${SITE_URL}/articulo/${slug}` },
    ],
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let article: Awaited<ReturnType<typeof api.contentBySlug>>;
  try {
    article = await api.contentBySlug(slug);
  } catch {
    return notFound();
  }

  const faqs = article.faq_section ?? [];
  const readingTime = Math.ceil((article.body_md?.split(" ").length ?? 0) / 200);

  let related: Awaited<ReturnType<typeof api.relatedContent>> = [];
  try {
    const all = await api.relatedContent(20);
    related = all.filter((a) => a.slug !== slug).slice(0, 4);
  } catch {
    related = [];
  }

  return (
    <>
      {/* Schema markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema(article)) }}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(article.title, article.slug)),
        }}
      />

      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-xs text-slate-600 mb-6 flex items-center gap-2">
          <a href="/" className="hover:text-slate-400">Inicio</a>
          <span>›</span>
          <a href="/articulos" className="hover:text-slate-400">Artículos</a>
          <span>›</span>
          <span className="text-slate-500 line-clamp-1">{article.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 leading-tight mb-4">
            {article.title}
          </h1>
          {article.meta_description && (
            <p className="text-lg text-slate-400 leading-relaxed mb-5">
              {article.meta_description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-green-500/20 inline-flex items-center justify-center text-green-400 text-xs font-bold">
                C
              </span>
              {AUTHOR}
            </span>
            <span>·</span>
            <time dateTime={article.updated_at}>
              {new Date(article.updated_at).toLocaleDateString("es-CO", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {readingTime > 0 && (
              <>
                <span>·</span>
                <span>{readingTime} min de lectura</span>
              </>
            )}
          </div>
        </header>

        {/* Article body */}
        <article
          className="prose prose-invert prose-slate max-w-none
            prose-headings:text-slate-100 prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
            prose-strong:text-slate-100
            prose-ul:text-slate-300 prose-ol:text-slate-300
            prose-li:mb-1
            prose-a:text-green-400 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-green-500 prose-blockquote:text-slate-400
            prose-code:text-green-400 prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none"
          dangerouslySetInnerHTML={{
            __html: article.body_html || mdToHtml(article.body_md || ""),
          }}
        />

        {/* Mid-article CTA */}
        <div className="my-10 p-6 bg-green-500/5 border border-green-500/20 rounded-2xl">
          <p className="text-sm text-green-300 font-medium mb-1">
            ¿Quieres abrir tu cuenta en dólares desde Colombia?
          </p>
          <p className="text-sm text-slate-400 mb-4">
            ikigii (Towerbank) es la opción más usada por colombianos. Sin comisiones de mantenimiento.
          </p>
          <a
            href="https://ikigii.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Abrir cuenta ikigii →
          </a>
        </div>

        {/* FAQ section */}
        {faqs.length > 0 && (
          <section className="mt-10 mb-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Preguntas frecuentes</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-slate-200 hover:text-white list-none">
                    {faq.question}
                    <span className="ml-4 shrink-0 text-slate-500 group-open:rotate-180 transition-transform">
                      ▾
                    </span>
                  </summary>
                  <p className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-700/50 pt-3">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Email capture */}
        <div className="mt-10 mb-8">
          <EmailCaptureForm
            origenUrl={`${SITE_URL}/articulo/${article.slug}`}
            temaInteres={article.keyword}
            intentScore={6}
            headline="Recibe más guías como esta"
            subheadline="Cada semana envío las mejores estrategias financieras para colombianos en el exterior."
            ctaText="Suscribirse gratis →"
          />
        </div>

        {/* Author box */}
        <div className="border-t border-slate-800 pt-8 mt-8 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-lg shrink-0">
            C
          </div>
          <div>
            <div className="font-medium text-slate-200 text-sm">{AUTHOR}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Especialista en Finanzas Internacionales · 10+ años ayudando a colombianos a
              acceder al sistema financiero global.
            </div>
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <section className="mt-12 pt-8 border-t border-slate-800">
            <h2 className="text-lg font-bold text-slate-200 mb-4">También te puede interesar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <a
                  key={r.id}
                  href={`/articulo/${r.slug}`}
                  className="block bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all hover:bg-slate-800/80 group"
                >
                  <div className="text-sm font-medium text-slate-200 group-hover:text-white leading-snug line-clamp-2">
                    {r.title}
                  </div>
                  <div className="text-xs text-slate-600 mt-2 font-mono">{r.keyword}</div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// ─── Fallback MD→HTML (simple, for when body_html is empty) ─────────────────
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}
