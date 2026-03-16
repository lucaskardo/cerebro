import type { Metadata } from "next";
import CalculadoraClient from "./CalculadoraClient";

export const metadata: Metadata = {
  title: "Calculadora de Remesas Colombia — ¿Cuánto pierde tu familia? | Dólar Afuera",
  description:
    "Calcula cuánto dinero pierdes al año enviando remesas con Western Union, MoneyGram o tu banco. Descubre las alternativas que usan los colombianos inteligentes.",
  openGraph: {
    title: "¿Cuánto pierde tu familia en remesas? Calcula aquí",
    description:
      "El colombiano promedio pierde $400–$1,200 USD al año en comisiones. Calcula tu caso en 30 segundos.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "¿Cuánto pierde tu familia en remesas?",
    description: "Calcula en 30 segundos. El resultado te va a sorprender.",
  },
};

export default function CalculadoraPage() {
  return (
    <div className="py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Calculadora de Remesas Colombia",
            description:
              "Calcula cuánto pierdes en comisiones al enviar o recibir remesas internacionales desde Colombia.",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            author: {
              "@type": "Person",
              name: "Carlos Medina",
              url: "https://dolarafuera.co",
            },
          }),
        }}
      />
      <CalculadoraClient />
    </div>
  );
}
