import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Uso | ColchonesPanamá",
  description: "Términos y condiciones de uso de ColchonesPanamá.com",
};

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 article-body">
      <h1 className="font-serif text-4xl font-bold text-primary dark:text-text-dark mb-8">
        Términos de Uso
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Última actualización: Marzo 2026
      </p>

      <h2>Uso del sitio</h2>
      <p>
        ColchonesPanamá.com es un sitio editorial independiente. El contenido es de carácter
        informativo y no constituye asesoramiento médico. Consulta a un profesional de salud
        para cualquier condición médica relacionada con el sueño.
      </p>

      <h2>Divulgación de afiliados</h2>
      <p>
        Algunos enlaces en este sitio pueden generar una comisión para ColchonesPanamá si
        realizas una compra. Esto no afecta nuestras evaluaciones ni recomendaciones. Siempre
        recomendamos lo que consideramos mejor para el consumidor.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Todo el contenido de este sitio es propiedad de ColchonesPanamá.com. No está permitida
        su reproducción sin autorización expresa.
      </p>

      <h2>Contacto</h2>
      <p>
        <a href="mailto:hola@colchonespanama.com">hola@colchonespanama.com</a>
      </p>
    </div>
  );
}
