import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisitorTracker from "@/components/VisitorTracker";

const SITE_URL = "https://colchonespanama.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ColchonesPanamá — Guías y Comparativas de Colchones en Panamá",
    template: "%s | ColchonesPanamá",
  },
  description:
    "Guías imparciales, comparativas honestas y herramientas para encontrar tu colchón ideal en Panamá. Evaluaciones basadas en metodología transparente.",
  keywords: ["colchones panamá", "mejor colchón panamá", "comparativa colchones", "guía colchones"],
  openGraph: {
    type: "website",
    locale: "es_PA",
    url: SITE_URL,
    siteName: "ColchonesPanamá",
    images: [{ url: `${SITE_URL}/og-default.jpg`, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PA" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-bg-light text-text-light dark:bg-bg-dark dark:text-text-dark antialiased">
        <VisitorTracker />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
