import type { Metadata } from "next";
import QuizCuentaIdeal from "./QuizCuentaIdeal";

const SITE_URL = `https://${process.env.PRIMARY_DOMAIN || "dolarafuera.co"}`;

export const metadata: Metadata = {
  title: "Quiz: ¿Qué cuenta en dólares es ideal para ti? | Dólar Afuera",
  description: "5 preguntas para saber si necesitas Wise, una cuenta offshore o una cuenta bancaria panameña. Recomendación personalizada gratis.",
  alternates: { canonical: `${SITE_URL}/herramientas/quiz-cuenta-ideal` },
  openGraph: {
    title: "Quiz: ¿Qué cuenta en dólares es ideal para ti?",
    description: "Responde 5 preguntas y recibe tu recomendación personalizada",
    url: `${SITE_URL}/herramientas/quiz-cuenta-ideal`,
    type: "website",
    siteName: "Dólar Afuera",
  },
};

export default function QuizPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <nav className="text-xs text-slate-600 mb-6 flex items-center gap-2">
        <a href="/" className="hover:text-slate-400">Inicio</a>
        <span>›</span>
        <span className="text-slate-500">Herramientas</span>
        <span>›</span>
        <span className="text-slate-500">Quiz Cuenta Ideal</span>
      </nav>
      <div className="text-center mb-8">
        <div className="inline-block text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1 rounded-full mb-4">
          2 minutos · Gratis
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-3">¿Qué cuenta en dólares es ideal para ti?</h1>
        <p className="text-slate-400">Responde 5 preguntas y te decimos exactamente qué opción se adapta a tu situación.</p>
      </div>
      <QuizCuentaIdeal />
    </div>
  );
}
