import type { Metadata } from "next";
import LeadCaptureForm from "@/components/LeadCaptureForm";

export const metadata: Metadata = {
  title: "Contacto | ColchonesPanamá",
  description: "¿Tienes preguntas, sugerencias o quieres colaborar? Escríbenos.",
};

export default function ContactoPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20">
      <h1 className="font-serif text-4xl font-bold text-primary dark:text-text-dark mb-4">Contacto</h1>
      <p className="text-gray-500 dark:text-gray-400 text-lg mb-10">
        ¿Tienes preguntas sobre nuestra metodología, sugerencias de colchones a evaluar, o quieres
        colaborar con nosotros?
      </p>

      <div className="space-y-8">
        <div className="bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-2xl p-6">
          <h2 className="font-serif text-xl font-bold mb-2 text-primary dark:text-text-dark">
            Escríbenos
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            📧{" "}
            <a
              href="mailto:hola@colchonespanama.com"
              className="text-accent-600 dark:text-accent-400 hover:underline"
            >
              hola@colchonespanama.com
            </a>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Respondemos en 1-2 días hábiles.
          </p>
        </div>

        <LeadCaptureForm
          headline="¿Prefieres que te contactemos?"
          subheadline="Déjanos tu email y te escribimos."
          ctaText="Enviar →"
          ctaVariant="contacto"
          showName={true}
        />
      </div>
    </div>
  );
}
