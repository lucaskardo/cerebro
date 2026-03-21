"use client";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-primary-600 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-full bg-gold-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary-700" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
                </svg>
              </div>
              <span className="font-serif font-bold text-xl">ColchonesPanamá</span>
            </div>
            <p className="text-sm text-primary-200 leading-relaxed mb-4">
              La guía independiente de colchones más completa de Panamá. Sin patrocinios. Sin sesgos.
            </p>
            <div className="flex gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-accent-500 flex items-center justify-center text-sm transition-colors"
                aria-label="Instagram"
              >
                📸
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-accent-500 flex items-center justify-center text-sm transition-colors"
                aria-label="TikTok"
              >
                🎵
              </a>
            </div>
          </div>

          {/* Guías */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-primary-300 mb-4">
              Guías
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "¿Por qué me duele la espalda?", href: "/guia/dolor-espalda" },
                { label: "¿Cada cuánto cambiar el colchón?", href: "/guia/cada-cuanto-cambiar" },
                { label: "Materiales: qué funciona vs marketing", href: "/guia/materiales" },
                { label: "Guía de compra completa", href: "/blog" },
              ].map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-primary-200 hover:text-gold-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Rankings */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-primary-300 mb-4">
              Rankings
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Mejores Colchones 2026", href: "/mejores" },
                { label: "Mejor para dolor de espalda", href: "/mejores" },
                { label: "Mejor relación precio/calidad", href: "/mejores" },
                { label: "Comparador de marcas", href: "/comparar" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-primary-200 hover:text-gold-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Herramientas + Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-primary-300 mb-4">
              Herramientas
            </h4>
            <ul className="space-y-2.5 mb-6">
              {[
                { label: "Quiz: tu colchón ideal", href: "/quiz" },
                { label: "Comparador interactivo", href: "/comparar" },
                { label: "Sobre nosotros", href: "/sobre" },
                { label: "Metodología", href: "/sobre#metodologia" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-primary-200 hover:text-gold-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="space-y-2">
              {[
                { label: "Privacidad", href: "/privacidad" },
                { label: "Términos", href: "/terminos" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-xs text-primary-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-xs text-primary-300">
            <span>© 2026 ColchonesPanamá.com · Todos los derechos reservados</span>
          </div>
          <p className="text-xs text-primary-400 max-w-md">
            Algunos enlaces pueden generar una comisión. Esto no afecta nuestras recomendaciones.
          </p>
        </div>
      </div>
    </footer>
  );
}
