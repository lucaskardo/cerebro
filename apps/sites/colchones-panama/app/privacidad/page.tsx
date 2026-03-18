import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | ColchonesPanamá",
  description: "Política de privacidad de ColchonesPanamá.com",
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 article-body">
      <h1 className="font-serif text-4xl font-bold text-primary dark:text-text-dark mb-8">
        Política de Privacidad
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Última actualización: Marzo 2026
      </p>

      <h2>Información que recopilamos</h2>
      <p>
        Recopilamos únicamente el email y nombre (opcional) que nos proporcionas voluntariamente
        al suscribirte a nuestro boletín o al completar el quiz. No recopilamos información de
        pago ni datos sensibles.
      </p>

      <h2>Cómo usamos tu información</h2>
      <p>
        Usamos tu email exclusivamente para enviarte contenido editorial de ColchonesPanamá. No
        vendemos, alquilamos ni compartimos tu información con terceros. Puedes darte de baja
        en cualquier momento.
      </p>

      <h2>Cookies</h2>
      <p>
        Usamos cookies de análisis básico para entender cómo se usa el sitio. No usamos cookies
        de publicidad ni de seguimiento de terceros.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier consulta sobre privacidad:{" "}
        <a href="mailto:hola@colchonespanama.com">hola@colchonespanama.com</a>
      </p>
    </div>
  );
}
