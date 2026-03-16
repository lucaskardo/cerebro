import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CEREBRO v7 — Dashboard",
  description: "Sistema autónomo de tráfico y leads — ikigii Colombia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-900 text-slate-100">
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold text-green-400 tracking-wider text-sm">
              ⚡ CEREBRO v7
            </Link>
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/content"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Contenido
            </Link>
            <Link
              href="/leads"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Leads
            </Link>
            <Link
              href="/herramientas/calculadora-remesas"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Calculadora
            </Link>
            <div className="ml-auto text-xs text-slate-600">dolarafuera.co</div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
