import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="text-6xl mb-4 text-slate-700">404</div>
      <h2 className="text-lg font-medium text-slate-300 mb-2">Página no encontrada</h2>
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
        Volver al dashboard →
      </Link>
    </div>
  );
}
