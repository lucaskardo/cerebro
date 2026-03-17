import { api } from "@/lib/api";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 bg-green-400/10 border-green-400/20",
  achieved: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  paused: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

export default async function GoalsPage() {
  let goals: Awaited<ReturnType<typeof api.goals>> = [];
  let error: string | null = null;

  try {
    goals = await api.goals();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando goals";
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Goals</h1>
          <p className="text-sm text-slate-500 mt-1">{goals.length} objetivos activos</p>
        </div>
        <Link
          href="/strategies"
          className="text-xs px-3 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
        >
          Ver estrategias →
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {goals.map((goal) => {
          const progress = goal.target_value > 0
            ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
            : 0;
          return (
            <div
              key={goal.id}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="font-medium text-slate-200">{goal.description}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {goal.target_metric}: {goal.current_value} / {goal.target_value}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded border font-medium shrink-0 ${STATUS_COLORS[goal.status] ?? "text-slate-400"}`}>
                  {goal.status}
                </span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 mt-2">{progress}% completado</div>
            </div>
          );
        })}
      </div>

      {goals.length === 0 && !error && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-sm">No hay goals todavía.</p>
          <p className="text-xs mt-2 text-slate-700">Crea un goal via POST /api/goals</p>
        </div>
      )}
    </div>
  );
}
