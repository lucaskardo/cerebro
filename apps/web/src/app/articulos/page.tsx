import type { Metadata } from "next";
import { api, type ContentAsset } from "@/lib/api";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guías de Finanzas para Colombianos | Dólar Afuera",
  description:
    "Guías prácticas sobre cuentas en dólares, remesas, banca offshore y protección de ahorros para colombianos.",
  robots: { index: true, follow: true },
};

export default async function ArticulosPage() {
  let articles: ContentAsset[] = [];
  try {
    const all = await api.content();
    articles = all.filter((a) => ["approved", "review"].includes(a.status));
  } catch {
    articles = [];
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Guías de Finanzas</h1>
        <p className="text-slate-400">
          Todo lo que necesitas saber para manejar tu plata fuera del sistema bancario colombiano.
        </p>
      </div>

      {articles.length === 0 ? (
        <p className="text-slate-600 text-sm">Pronto habrá artículos aquí.</p>
      ) : (
        <div className="space-y-4">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/articulo/${a.slug}`}
              className="block bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 hover:border-slate-600 hover:bg-slate-800/70 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-200 group-hover:text-white text-lg leading-snug mb-2 transition-colors">
                    {a.title}
                  </h2>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    Keyword: {a.keyword}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                    <span>Carlos Medina</span>
                    <span>·</span>
                    <time>{new Date(a.updated_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</time>
                  </div>
                </div>
                <span className="text-slate-600 group-hover:text-slate-400 shrink-0 mt-1 transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Calculator CTA */}
      <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-bold text-slate-200 mb-1">Herramienta: Calculadora de Remesas</p>
          <p className="text-sm text-slate-400">Calcula cuánto pierde tu familia al año en comisiones.</p>
        </div>
        <Link
          href="/herramientas/calculadora-remesas"
          className="shrink-0 bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Calcular →
        </Link>
      </div>
    </div>
  );
}
