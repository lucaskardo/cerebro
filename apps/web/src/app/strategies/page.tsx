import { api } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  proposed: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  approved: "text-green-400 bg-green-400/10 border-green-400/20",
  running: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  completed: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  failed: "text-red-400 bg-red-400/10 border-red-400/20",
};

const CHANNEL_ICONS: Record<string, string> = {
  seo: "🔍",
  social: "📱",
  community: "💬",
  messaging: "📩",
  email: "✉️",
  outreach: "🤝",
};

export default async function StrategiesPage() {
  let strategies: Awaited<ReturnType<typeof api.strategies>> = [];
  let error: string | null = null;

  try {
    strategies = await api.strategies();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando estrategias";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Estrategias</h1>
        <p className="text-sm text-slate-500 mt-1">{strategies.length} estrategias propuestas</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {strategies.map((s) => (
          <div
            key={s.id}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{CHANNEL_ICONS[s.channel] ?? "⚡"}</span>
                <span className="font-medium text-slate-200 text-sm">{s.name}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded border font-medium shrink-0 ${STATUS_COLORS[s.status] ?? "text-slate-400"}`}>
                {s.status}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className="text-lg font-bold text-green-400">{s.estimated_leads}</div>
                <div className="text-xs text-slate-600">leads/mes</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className="text-lg font-bold text-slate-300">${s.estimated_cost}</div>
                <div className="text-xs text-slate-600">costo/mes</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className={`text-lg font-bold ${s.confidence_score >= 70 ? "text-green-400" : s.confidence_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                  {s.confidence_score}%
                </div>
                <div className="text-xs text-slate-600">confianza</div>
              </div>
            </div>

            {s.skills_needed.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.skills_needed.map((skill) => (
                  <span key={skill} className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {strategies.length === 0 && !error && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-4xl mb-4">🧠</div>
          <p className="text-sm">No hay estrategias todavía.</p>
          <p className="text-xs mt-2 text-slate-700">POST /api/strategies/generate?goal_id=...</p>
        </div>
      )}
    </div>
  );
}
