"use client";
import Link from "next/link";

const AUTHOR = "Dra. Sofía Reyes";

export default function Footer() {
  return (
    <footer className="bg-primary text-text-dark mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🌙</span>
              <span className="font-serif font-bold text-xl">ColchonesPanamá</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              La guía independiente de colchones más completa de Panamá. Sin patrocinios.
              Sin sesgos.
            </p>
            <div className="flex gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-accent-600 flex items-center justify-center text-sm transition-colors"
                aria-label="Instagram"
              >
                📸
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-accent-600 flex items-center justify-center text-sm transition-colors"
                aria-label="TikTok"
              >
                🎵
              </a>
            </div>
          </div>

          {/* Contenido Popular */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Contenido Popular
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Mejores Colchones 2026", href: "/mejores" },
                { label: "Quiz: ¿Cuál es tu colchón?", href: "/quiz" },
                { label: "Colchón para dolor de espalda", href: "/blog" },
                { label: "NauralSleep Review", href: "/blog" },
                { label: "Colchón vs Clima Tropical", href: "/blog" },
              ].map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-accent-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Herramientas */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Herramientas
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Quiz de Colchón", href: "/quiz" },
                { label: "Comparativa de Marcas", href: "/mejores" },
                { label: "Guía de Compra", href: "/blog" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-accent-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Sobre + Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Sobre
            </h4>
            <ul className="space-y-2.5 mb-6">
              {[
                { label: "Sobre Nosotros", href: "/sobre" },
                { label: "Metodología", href: "/sobre#metodologia" },
                { label: "Contacto", href: "/contacto" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-accent-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Privacidad", href: "/privacidad" },
                { label: "Términos", href: "/terminos" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-accent-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="border-t border-white/10 mt-12 pt-10">
          <div className="max-w-xl">
            <h4 className="font-serif text-lg font-bold mb-2">Consejos de sueño cada semana</h4>
            <p className="text-sm text-gray-400 mb-4">
              Guías actualizadas, comparativas honestas y las mejores ofertas en colchones en Panamá.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex gap-2"
            >
              <input
                type="email"
                placeholder="tu@email.com"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                Suscribirme
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-10 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            <span>Escrito por {AUTHOR} · Contenido actualizado semanalmente</span>
            <br className="md:hidden" />
            <span className="md:ml-4">© 2026 ColchonesPanamá.com · Todos los derechos reservados</span>
          </div>
          <p className="text-xs text-gray-600 max-w-md">
            Algunos enlaces pueden generar una comisión. Esto no afecta nuestras recomendaciones.
          </p>
        </div>
      </div>
    </footer>
  );
}
