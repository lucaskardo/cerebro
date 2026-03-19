"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ArticleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Article render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6">😴</div>
        <h1 className="font-serif font-bold text-2xl text-primary-700 dark:text-text-dark mb-3">
          Este artículo no pudo cargarse
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
          Ocurrió un error al mostrar este artículo. Puedes intentar de nuevo
          o volver al blog para leer otros artículos.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Intentar de nuevo
          </button>
          <Link
            href="/blog"
            className="px-5 py-2.5 border border-gray-300 dark:border-primary-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-primary-800/40 transition-colors"
          >
            Ver todos los artículos
          </Link>
        </div>
      </div>
    </div>
  );
}
