"use client";

import { useState } from "react";

interface Step {
  n: number;
  title: string;
  desc: string;
  detail: string;
}

export default function StepChecklist({ steps }: { steps: Step[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  function toggle(n: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  const progress = Math.round((checked.size / steps.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{checked.size} de {steps.length} completados</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {steps.map((step) => {
        const isDone = checked.has(step.n);
        const isOpen = expanded === step.n;
        return (
          <div
            key={step.n}
            className={`rounded-xl border transition-all ${isDone ? "border-green-500/30 bg-green-500/5" : "border-slate-700/50 bg-slate-800/50"}`}
          >
            <div className="flex items-start gap-4 p-4">
              <button
                onClick={() => toggle(step.n)}
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isDone ? "border-green-500 bg-green-500 text-slate-900" : "border-slate-600 hover:border-green-500"}`}
              >
                {isDone && <span className="text-xs font-bold">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : step.n)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm font-medium ${isDone ? "text-green-400 line-through" : "text-slate-200"}`}>
                      Paso {step.n}: {step.title}
                    </div>
                    <span className="text-slate-600 text-xs shrink-0">{isOpen ? "▲" : "▼"}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
                </button>
                {isOpen && (
                  <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-700/50 leading-relaxed">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {checked.size === steps.length && (
        <div className="text-center py-4">
          <div className="text-2xl mb-2">🎉</div>
          <p className="text-sm text-green-400 font-medium">¡Completaste todos los pasos!</p>
          <a
            href="https://ikigii.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Abrir mi cuenta ahora →
          </a>
        </div>
      )}
    </div>
  );
}
