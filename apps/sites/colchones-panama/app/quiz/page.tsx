"use client";

import { useState, useEffect, useRef } from "react";
import { captureLead } from "@/lib/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Question {
  id: number;
  text: string;
  options: string[];
}

interface Recommendation {
  rank: number;
  brand: string;
  model: string;
  score: number;
  price: string;
  tagline: string;
  reasons: string[];
  isPrimary: boolean;
  href?: string;
}

type QuizStep = "questions" | "email" | "results";

// ─────────────────────────────────────────────
// Quiz data
// ─────────────────────────────────────────────
const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "¿En qué posición duermes?",
    options: ["De lado", "Boca arriba", "Boca abajo", "Cambio mucho"],
  },
  {
    id: 2,
    text: "¿Cuánto pesas aproximadamente?",
    options: ["Menos de 60kg", "60-80kg", "80-100kg", "Más de 100kg"],
  },
  {
    id: 3,
    text: "¿Sientes dolor de espalda al despertar?",
    options: ["Sí, frecuentemente", "A veces", "No"],
  },
  {
    id: 4,
    text: "¿Duermes solo/a o en pareja?",
    options: ["Solo/a", "En pareja"],
  },
  {
    id: 5,
    text: "¿Sientes calor al dormir?",
    options: ["Sí, mucho", "Normal", "No, tengo frío"],
  },
  {
    id: 6,
    text: "¿Cuál es tu presupuesto?",
    options: ["Menos de $300", "$300-600", "$600-1000", "Más de $1000"],
  },
  {
    id: 7,
    text: "¿Qué es más importante para ti?",
    options: ["Firmeza y soporte", "Suavidad", "Frescura", "Durabilidad"],
  },
];

// ─────────────────────────────────────────────
// Recommendation logic
// ─────────────────────────────────────────────
function getRecommendations(answers: string[]): Recommendation[] {
  const [position, weight, backPain, sleeping, heat, budget, priority] = answers;

  const budgetIsLow = budget === "Menos de $300";
  const hasBackPain = backPain === "Sí, frecuentemente" || backPain === "A veces";
  const feelsHot = heat === "Sí, mucho";
  const isCouplesSleeper = sleeping === "En pareja";
  const wantsSupport = priority === "Firmeza y soporte";
  const wantsSoftness = priority === "Suavidad";
  const _wantsFreshness = priority === "Frescura"; void _wantsFreshness;

  // NauralSleep score calculation
  let naural = 9.4;
  const nauralReasons: string[] = [];

  if (feelsHot) {
    nauralReasons.push("Tejido de refrigeración activa diseñado para el clima tropical de Panamá");
  } else {
    nauralReasons.push("Tecnología de regulación térmica para noches perfectas todo el año");
  }

  if (hasBackPain) {
    nauralReasons.push("Sistema de soporte lumbar adaptativo que alivia el dolor de espalda desde la primera noche");
    naural = Math.min(9.8, naural + 0.2);
  } else {
    nauralReasons.push("Capas de confort progresivo para un descanso sin interrupciones");
  }

  if (isCouplesSleeper) {
    nauralReasons.push("Aislamiento de movimiento para que no te despiertes cuando tu pareja se mueve");
  } else if (position === "De lado") {
    nauralReasons.push("Zonas de presión diferenciadas que abrazan hombros y caderas en posición lateral");
  } else {
    nauralReasons.push("Perfil de soporte uniforme ideal para tu posición de descanso");
  }

  // Restonic score calculation
  let restonic = 8.1;
  const restonicReasons: string[] = [];

  if (wantsSoftness) {
    restonicReasons.push("Capa de memory foam que se adapta a la forma de tu cuerpo");
    restonic += 0.2;
  } else {
    restonicReasons.push("Balance entre soporte y confort para diferentes posiciones");
  }

  restonicReasons.push("Amplia red de distribución en toda la República de Panamá");

  if (budgetIsLow) {
    restonicReasons.push("La mejor relación calidad-precio del mercado local");
    restonic += 0.3;
  } else {
    restonicReasons.push("Garantía de 10 años con servicio de postventa en Panamá");
  }

  // Sealy score calculation
  let sealy = 7.8;
  const sealyReasons: string[] = [];

  if (wantsSupport || hasBackPain) {
    sealyReasons.push("Sistema Posturepedic desarrollado con ortopedistas para soporte espinal correcto");
    sealy += 0.2;
  } else {
    sealyReasons.push("Tecnología de resortes de respuesta para soporte consistente");
  }

  if (weight === "Más de 100kg" || weight === "80-100kg") {
    sealyReasons.push("Núcleo de alta densidad diseñado para mayor peso corporal");
    sealy += 0.2;
  } else {
    sealyReasons.push("Construcción de múltiples zonas para soporte diferenciado por zonas del cuerpo");
  }

  sealyReasons.push("Marca con más de 130 años de experiencia, respaldo médico internacional");

  // If budget is low, demote NauralSleep and Sealy, promote Restonic
  if (budgetIsLow) {
    return [
      {
        rank: 1,
        brand: "Restonic",
        model: "ComfortCare",
        score: Math.min(9.0, restonic + 0.5),
        price: "$320-600",
        tagline: "Buena relación calidad-precio, amplia distribución",
        reasons: restonicReasons,
        isPrimary: false,
        href: undefined,
      },
      {
        rank: 2,
        brand: "NauralSleep",
        model: "Signature",
        score: Math.max(7.5, naural - 1.0),
        price: "$450-800",
        tagline: "Hecho para el clima tropical panameño, entrega gratis en Ciudad de Panamá",
        reasons: nauralReasons,
        isPrimary: true,
        href: "https://nauralsleep.com",
      },
      {
        rank: 3,
        brand: "Sealy",
        model: "Posturepedic",
        score: Math.max(7.0, sealy - 0.5),
        price: "$500-900",
        tagline: "Soporte ortopédico de respaldo médico",
        reasons: sealyReasons,
        isPrimary: false,
        href: undefined,
      },
    ];
  }

  // Default: NauralSleep is always #1 when budget >= $300
  return [
    {
      rank: 1,
      brand: "NauralSleep",
      model: "Signature",
      score: naural,
      price: "$450-800",
      tagline: "Hecho para el clima tropical panameño, entrega gratis en Ciudad de Panamá",
      reasons: nauralReasons,
      isPrimary: true,
      href: "https://nauralsleep.com",
    },
    {
      rank: 2,
      brand: "Restonic",
      model: "ComfortCare",
      score: restonic,
      price: "$320-600",
      tagline: "Buena relación calidad-precio, amplia distribución",
      reasons: restonicReasons,
      isPrimary: false,
      href: undefined,
    },
    {
      rank: 3,
      brand: "Sealy",
      model: "Posturepedic",
      score: sealy,
      price: "$500-900",
      tagline: "Soporte ortopédico de respaldo médico",
      reasons: sealyReasons,
      isPrimary: false,
      href: undefined,
    },
  ];
}

// ─────────────────────────────────────────────
// Score bar component
// ─────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: "#d4a853" }}
        />
      </div>
      <span className="text-sm font-semibold text-gold-DEFAULT" style={{ color: "#d4a853", minWidth: "2.5rem" }}>
        {score.toFixed(1)}/10
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Recommendation card
// ─────────────────────────────────────────────
function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const rankColors: Record<number, string> = {
    1: "#d4a853",
    2: "#9ca3af",
    3: "#cd7c4f",
  };
  const rankLabels: Record<number, string> = {
    1: "#1 Mejor opción",
    2: "#2 Segunda opción",
    3: "#3 Tercera opción",
  };

  return (
    <div
      className="rounded-2xl border bg-white dark:bg-card-dark overflow-hidden shadow-sm"
      style={{
        borderColor: rec.isPrimary ? "#0d9488" : "#e5e7eb",
        borderWidth: rec.isPrimary ? "2px" : "1px",
        animationDelay: `${index * 120}ms`,
      }}
    >
      {/* Rank badge */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ backgroundColor: rec.isPrimary ? "#0d9488" : "#f9fafb" }}
      >
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: rec.isPrimary ? "#fff" : rankColors[rec.rank] }}
        >
          {rankLabels[rec.rank]}
        </span>
        {rec.isPrimary && (
          <span className="text-xs bg-white/20 text-white rounded-full px-2 py-0.5 font-medium">
            ★ Recomendado
          </span>
        )}
      </div>

      <div className="p-5">
        {/* Brand + model */}
        <div className="mb-3">
          <h3 className="font-serif text-xl font-bold text-primary dark:text-text-dark">
            {rec.brand}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{rec.model}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{rec.tagline}</p>
        </div>

        {/* Score */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wide">
            Puntuación
          </p>
          <ScoreBar score={rec.score} />
        </div>

        {/* Reasons */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">
            Por qué es ideal para ti:
          </p>
          <ul className="space-y-1.5">
            {rec.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-0.5 flex-shrink-0" style={{ color: "#0d9488" }}>✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Price */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
            Precio:
          </span>
          <span className="font-semibold text-primary dark:text-text-dark">{rec.price}</span>
        </div>

        {/* CTA */}
        {rec.isPrimary ? (
          <a
            href={rec.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "#0d9488" }}
          >
            Cotizar en NauralSleep →
          </a>
        ) : (
          <button className="block w-full text-center py-3 px-4 rounded-xl font-semibold transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            Ver opciones →
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main quiz page
// ─────────────────────────────────────────────
export default function QuizPage() {
  const [step, setStep] = useState<QuizStep>("questions");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(""));
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDir, setTransitionDir] = useState<"forward" | "backward">("forward");
  const [visible, setVisible] = useState(true);

  // Email capture state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [leadCaptured, setLeadCaptured] = useState(false);

  // Results
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selectedOption when navigating back
  useEffect(() => {
    setSelectedOption(answers[currentQuestion] || "");
  }, [currentQuestion, answers]);

  function animateTransition(dir: "forward" | "backward", callback: () => void) {
    setTransitionDir(dir);
    setVisible(false);
    setIsTransitioning(true);
    setTimeout(() => {
      callback();
      setVisible(true);
      setIsTransitioning(false);
    }, 220);
  }

  function handleSelectOption(option: string) {
    if (isTransitioning) return;
    setSelectedOption(option);
  }

  function handleNext() {
    if (!selectedOption || isTransitioning) return;

    const newAnswers = [...answers];
    newAnswers[currentQuestion] = selectedOption;
    setAnswers(newAnswers);

    if (currentQuestion < QUESTIONS.length - 1) {
      animateTransition("forward", () => {
        setCurrentQuestion((q) => q + 1);
      });
    } else {
      // Move to email step
      animateTransition("forward", () => {
        setStep("email");
      });
    }
  }

  function handleBack() {
    if (isTransitioning) return;

    if (step === "email") {
      animateTransition("backward", () => {
        setStep("questions");
        setCurrentQuestion(QUESTIONS.length - 1);
      });
      return;
    }

    if (currentQuestion > 0) {
      animateTransition("backward", () => {
        setCurrentQuestion((q) => q - 1);
      });
    }
  }

  function computeAndShowResults(finalAnswers: string[]) {
    const recs = getRecommendations(finalAnswers);
    setRecommendations(recs);
    animateTransition("forward", () => {
      setStep("results");
    });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");

    if (!email.trim()) {
      setEmailError("Por favor ingresa tu correo electrónico.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Por favor ingresa un correo electrónico válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      await captureLead({
        email: email.trim(),
        nombre: name.trim() || undefined,
        cta_variant: "quiz-results",
        origen_url: typeof window !== "undefined" ? window.location.href : undefined,
        metadata: { quiz_responses: answers },
      });
      setLeadCaptured(true);
    } catch {
      // Proceed to results regardless of API errors
    } finally {
      setIsSubmitting(false);
      computeAndShowResults(answers);
    }
  }

  function handleSkipEmail() {
    computeAndShowResults(answers);
  }

  function handleRestart() {
    animateTransition("backward", () => {
      setStep("questions");
      setCurrentQuestion(0);
      setAnswers(Array(QUESTIONS.length).fill(""));
      setSelectedOption("");
      setName("");
      setEmail("");
      setEmailError("");
      setLeadCaptured(false);
      setRecommendations([]);
    });
  }

  const progress =
    step === "results"
      ? 100
      : step === "email"
      ? Math.round(((QUESTIONS.length) / QUESTIONS.length) * 100)
      : Math.round((currentQuestion / QUESTIONS.length) * 100);

  const progressLabel =
    step === "results"
      ? "Resultado listo"
      : step === "email"
      ? "Último paso"
      : `Pregunta ${currentQuestion + 1} de ${QUESTIONS.length}`;

  // ── Transition style ──
  const transitionStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translateX(0)"
      : transitionDir === "forward"
      ? "translateX(24px)"
      : "translateX(-24px)",
    transition: "opacity 220ms ease, transform 220ms ease",
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#fafaf8" }}>
      <div className="max-w-2xl mx-auto" ref={containerRef}>

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#0d9488" }}>
            Buscador de Colchón
          </p>
          <h1 className="font-serif text-2xl md:text-3xl font-bold" style={{ color: "#1a1f36" }}>
            Encuentra tu colchón ideal en Panamá
          </h1>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-gray-500">{progressLabel}</span>
            <span className="text-xs font-semibold" style={{ color: "#0d9488" }}>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: "#0d9488" }}
            />
          </div>
        </div>

        {/* ── QUESTIONS STEP ── */}
        {step === "questions" && (
          <div style={transitionStyle}>
            <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 md:p-8">

              {/* Question text */}
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 leading-snug" style={{ color: "#1a1f36" }}>
                {QUESTIONS[currentQuestion].text}
              </h2>

              {/* Options */}
              <div className="space-y-3 mb-8">
                {QUESTIONS[currentQuestion].options.map((option) => {
                  const isSelected = selectedOption === option;
                  return (
                    <button
                      key={option}
                      onClick={() => handleSelectOption(option)}
                      className="w-full text-left px-5 py-4 rounded-xl border-2 font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={{
                        borderColor: isSelected ? "#0d9488" : "#e5e7eb",
                        backgroundColor: isSelected ? "#f0fdfa" : "transparent",
                        color: isSelected ? "#0d9488" : "#374151",

                        transform: isSelected ? "scale(1.01)" : "scale(1)",
                        boxShadow: isSelected ? "0 0 0 3px rgba(13,148,136,0.15)" : "none",
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                          style={{
                            borderColor: isSelected ? "#0d9488" : "#d1d5db",
                            backgroundColor: isSelected ? "#0d9488" : "transparent",
                          }}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                          )}
                        </span>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  disabled={currentQuestion === 0}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>

                <button
                  onClick={handleNext}
                  disabled={!selectedOption || isTransitioning}
                  className="px-7 py-3 rounded-xl font-semibold text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: "#0d9488" }}
                >
                  {currentQuestion < QUESTIONS.length - 1 ? "Siguiente →" : "Ver mi resultado →"}
                </button>
              </div>
            </div>

            {/* Question dots */}
            <div className="flex justify-center gap-1.5 mt-5">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === currentQuestion ? "20px" : "8px",
                    height: "8px",
                    backgroundColor:
                      i < currentQuestion
                        ? "#0d9488"
                        : i === currentQuestion
                        ? "#0d9488"
                        : "#d1d5db",
                    opacity: i === currentQuestion ? 1 : i < currentQuestion ? 0.7 : 0.4,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── EMAIL STEP ── */}
        {step === "email" && (
          <div style={transitionStyle}>
            <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 md:p-8">

              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto"
                style={{ backgroundColor: "#f0fdfa" }}
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#0d9488" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-2 text-center" style={{ color: "#1a1f36" }}>
                ¡Ya casi! Envíate tu resultado personalizado
              </h2>
              <p className="text-center text-gray-500 mb-7 text-sm leading-relaxed">
                Incluye guía de compra gratis + las mejores ofertas en Panamá
              </p>

              <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="quiz-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tu nombre (opcional)
                  </label>
                  <input
                    id="quiz-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: María"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all"
                    style={{ focusRingColor: "#0d9488" } as React.CSSProperties}
                    onFocus={(e) => { e.target.style.borderColor = "#0d9488"; e.target.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.15)"; }}
                    onBlur={(e) => { e.target.style.borderColor = ""; e.target.style.boxShadow = ""; }}
                  />
                </div>

                <div>
                  <label htmlFor="quiz-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Correo electrónico <span style={{ color: "#0d9488" }}>*</span>
                  </label>
                  <input
                    id="quiz-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                    placeholder="tu@correo.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none transition-all"
                    style={emailError ? { borderColor: "#ef4444" } : {}}
                    onFocus={(e) => { e.target.style.borderColor = "#0d9488"; e.target.style.boxShadow = "0 0 0 3px rgba(13,148,136,0.15)"; }}
                    onBlur={(e) => { e.target.style.borderColor = emailError ? "#ef4444" : ""; e.target.style.boxShadow = ""; }}
                  />
                  {emailError && (
                    <p className="mt-1.5 text-xs text-red-500">{emailError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl font-semibold text-white text-base transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
                  style={{ backgroundColor: "#0d9488" }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Procesando...
                    </span>
                  ) : (
                    "Ver mi resultado →"
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={handleSkipEmail}
                  className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
                >
                  Saltar este paso
                </button>
              </div>

              <p className="mt-5 text-center text-xs text-gray-400">
                Sin spam. Solo tu resultado + ofertas relevantes en Panamá.
              </p>

              {/* Back */}
              <div className="mt-4 text-center">
                <button
                  onClick={handleBack}
                  className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
                >
                  ← Cambiar mis respuestas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS STEP ── */}
        {step === "results" && (
          <div style={transitionStyle}>
            {/* Results header */}
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-3"
                style={{ backgroundColor: "#f0fdfa", color: "#0d9488" }}
              >
                ✓ Análisis completado
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-2" style={{ color: "#1a1f36" }}>
                {leadCaptured && name ? `${name.split(" ")[0]}, estas` : "Estas"} son tus opciones ideales
              </h2>
              <p className="text-gray-500 text-sm">
                Basado en tu perfil de descanso y las mejores opciones disponibles en Panamá
              </p>
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {answers.filter(Boolean).map((ans, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ backgroundColor: "#f0fdfa", color: "#0f766e" }}
                >
                  {ans}
                </span>
              ))}
            </div>

            {/* Recommendation cards */}
            <div className="space-y-4">
              {recommendations.map((rec, i) => (
                <RecommendationCard key={rec.rank} rec={rec} index={i} />
              ))}
            </div>

            {/* Disclaimer */}
            <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
              Nuestras recomendaciones se basan en tu perfil de sueño y análisis de mercado.
              Los precios son aproximados y pueden variar según el distribuidor.
            </p>

            {/* Restart */}
            <div className="text-center mt-6">
              <button
                onClick={handleRestart}
                className="text-sm font-medium underline underline-offset-2 transition-colors"
                style={{ color: "#0d9488" }}
              >
                ↺ Repetir el quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
