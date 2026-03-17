"use client";

import { useState } from "react";
import { captureLead } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "https://dolarafuera.co";

const questions = [
  {
    id: "objetivo",
    text: "¿Cuál es tu objetivo principal?",
    options: [
      { value: "enviar", label: "Enviar remesas a mi familia en Colombia" },
      { value: "recibir", label: "Recibir pagos en dólares por mi trabajo" },
      { value: "ahorrar", label: "Proteger mis ahorros de la devaluación" },
      { value: "todo", label: "Todo lo anterior" },
    ],
  },
  {
    id: "monto",
    text: "¿Cuánto dinero mueves al mes en USD?",
    options: [
      { value: "menos200", label: "Menos de $200 USD" },
      { value: "200_1000", label: "Entre $200 y $1,000 USD" },
      { value: "1000_5000", label: "Entre $1,000 y $5,000 USD" },
      { value: "mas5000", label: "Más de $5,000 USD" },
    ],
  },
  {
    id: "frecuencia",
    text: "¿Con qué frecuencia necesitas la cuenta?",
    options: [
      { value: "ocasional", label: "Ocasionalmente (1-2 veces al año)" },
      { value: "mensual", label: "Mensualmente" },
      { value: "semanal", label: "Semanalmente o más" },
      { value: "diario", label: "Todos los días" },
    ],
  },
  {
    id: "urgencia",
    text: "¿Qué tan urgente necesitas el dinero cuando lo envías?",
    options: [
      { value: "inmediato", label: "Inmediato (en horas)" },
      { value: "dias", label: "En 1-3 días está bien" },
      { value: "semana", label: "En una semana no hay problema" },
      { value: "na", label: "No envío, solo guardo/recibo" },
    ],
  },
  {
    id: "perfil",
    text: "¿Cuál describe mejor tu situación?",
    options: [
      { value: "freelance", label: "Freelancer / trabajo remoto cobrando en USD" },
      { value: "expat", label: "Colombiano viviendo en el exterior" },
      { value: "negocio", label: "Tengo un negocio con clientes internacionales" },
      { value: "familiar", label: "Envío dinero a familia en Colombia" },
    ],
  },
];

type Answers = Record<string, string>;

function getRecommendation(answers: Answers) {
  const { objetivo, monto, frecuencia, urgencia, perfil } = answers;

  if (urgencia === "inmediato") {
    return {
      title: "Western Union o Nequi",
      subtitle: "Para transferencias urgentes en efectivo",
      description: "Si necesitas que el dinero llegue en horas y el destinatario necesita efectivo, Western Union o Nequi son las opciones más rápidas, aunque con mayor costo.",
      score: 60,
      cta: "Compara todas las opciones",
      ctaUrl: "/comparar/wise-vs-western-union-colombia",
      color: "yellow",
    };
  }

  if (perfil === "freelance" || objetivo === "recibir" || objetivo === "todo") {
    return {
      title: "Cuenta ikigii (Towerbank Panamá)",
      subtitle: "La opción #1 para freelancers y emprendedores colombianos",
      description: "Con ikigii obtienes una cuenta bancaria real en USD con número SWIFT/IBAN, puedes recibir pagos de PayPal, Stripe, Deel y cualquier empresa internacional. Sin comisiones de mantenimiento.",
      score: 95,
      cta: "Abrir cuenta ikigii gratis",
      ctaUrl: "https://ikigii.com",
      color: "green",
    };
  }

  if (monto === "menos200" && frecuencia === "ocasional") {
    return {
      title: "Wise",
      subtitle: "Para transferencias ocasionales de montos pequeños",
      description: "Si solo envías dinero ocasionalmente, Wise es suficiente. Tarifas bajas y tipo de cambio real. No necesitas cuenta permanente.",
      score: 75,
      cta: "Ver comparativa Wise vs otras opciones",
      ctaUrl: "/comparar/wise-vs-western-union-colombia",
      color: "blue",
    };
  }

  return {
    title: "Cuenta ikigii (Towerbank Panamá)",
    subtitle: "La opción más completa para tu perfil",
    description: "Dado tu volumen y frecuencia, una cuenta bancaria real en USD es lo más conveniente. Con ikigii abres en 15 minutos desde Colombia, sin viajar a Panamá.",
    score: 90,
    cta: "Abrir cuenta ikigii gratis →",
    ctaUrl: "https://ikigii.com",
    color: "green",
  };
}

export default function QuizCuentaIdeal() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const question = questions[current];
  const recommendation = done ? getRecommendation(answers) : null;
  const progress = Math.round(((current) / questions.length) * 100);

  function handleAnswer(value: string) {
    const newAnswers = { ...answers, [question.id]: value };
    setAnswers(newAnswers);
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
    } else {
      setDone(true);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await captureLead({
        email,
        nombre,
        origen_url: "/herramientas/quiz-cuenta-ideal",
        tema_interes: "quiz cuenta ideal: " + (recommendation?.title || ""),
        intent_score: 8,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (done && recommendation) {
    const colorMap: Record<string, string> = {
      green: "border-green-500/30 bg-green-500/5",
      blue: "border-blue-500/30 bg-blue-500/5",
      yellow: "border-yellow-500/30 bg-yellow-500/5",
    };
    const textMap: Record<string, string> = {
      green: "text-green-400",
      blue: "text-blue-400",
      yellow: "text-yellow-400",
    };

    return (
      <div className="space-y-6">
        <div className={`rounded-2xl border p-6 ${colorMap[recommendation.color]}`}>
          <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${textMap[recommendation.color]}`}>
            Tu recomendación
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{recommendation.title}</h2>
          <div className={`text-sm font-medium mb-3 ${textMap[recommendation.color]}`}>{recommendation.subtitle}</div>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">{recommendation.description}</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-slate-700/50 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${recommendation.color === "green" ? "bg-green-500" : recommendation.color === "blue" ? "bg-blue-500" : "bg-yellow-500"}`}
                style={{ width: `${recommendation.score}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${textMap[recommendation.color]}`}>{recommendation.score}% match</span>
          </div>
          <a
            href={recommendation.ctaUrl}
            target={recommendation.ctaUrl.startsWith("http") ? "_blank" : undefined}
            rel={recommendation.ctaUrl.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-block bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {recommendation.cta}
          </a>
        </div>

        {!submitted ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-1">Recibe la guía completa por email</h3>
            <p className="text-sm text-slate-500 mb-4">Te enviamos una comparativa detallada personalizada para tu perfil.</p>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-500"
              />
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-slate-900 font-bold text-sm py-3 rounded-xl transition-colors"
              >
                {loading ? "Enviando..." : "Recibir guía personalizada →"}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center text-sm text-green-400">
            ✓ ¡Listo! Revisa tu email en los próximos minutos.
          </div>
        )}

        <button
          onClick={() => { setCurrent(0); setAnswers({}); setDone(false); setSubmitted(false); }}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          ← Repetir quiz
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Pregunta {current + 1} de {questions.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-1.5">
          <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-medium text-slate-100 mb-5">{question.text}</h2>
        <div className="space-y-3">
          {question.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleAnswer(opt.value)}
              className="w-full text-left px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm text-slate-300 hover:border-green-500/50 hover:text-white hover:bg-green-500/5 transition-all"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
