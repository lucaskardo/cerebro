import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl mb-6">😴</div>
      <h1 className="font-serif text-4xl font-bold text-primary dark:text-text-dark mb-4">
        Página no encontrada
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 max-w-md">
        Esta página se quedó dormida. Vuelve al inicio para encontrar lo que buscas.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link
          href="/"
          className="px-6 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-colors"
        >
          Ir al inicio
        </Link>
        <Link
          href="/mejores"
          className="px-6 py-3 border-2 border-accent-600 text-accent-600 dark:text-accent-400 font-semibold rounded-xl hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors"
        >
          Ver mejores colchones
        </Link>
      </div>
    </div>
  );
}
