import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return [] as unknown as T;
    return res.json();
  } catch {
    return [] as unknown as T;
  }
}

interface CycleRun {
  id: string;
  goal_id: string | null;
  status: string;
  opportunities_generated: number;
  experiments_created: number;
  tasks_auto_run: number;
  tasks_queued_approval: number;
  kill_reason: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface KnowledgeEntry {
  id: string;
  category: string;
  insight: string;
  confidence: string;
  metric_name: string | null;
  metric_value: number | null;
  sample_size: number | null;
  created_at: string;
}

interface ExperimentRow {
  id: string;
  hypothesis: string;
  status: string;
  outcome_json: Record<string, unknown> | null;
  evaluated_at: string | null;
}

interface BusinessHealth {
  leads_today: number;
  leads_this_week: number;
  qualified_leads_week: number;
  conversion_rate_7d: number;
  articles_published_week: number;
  error_rate_24h: number;
  cost_today: number;
  revenue_7d: number;
  top_performing_asset_title: string | null;
  top_opportunity: string | null;
  worst_experiment: string | null;
  knowledge_entries_this_week: number;
  budget_remaining: number;
  budget_warning: boolean;
  last_cycle_at: string | null;
  last_cycle_status: string | null;
}

const CYCLE_STATUS_COLOR: Record<string, string> = {
  completed: "text-green-400 bg-green-400/10 border-green-400/20",
  running:   "text-blue-400 bg-blue-400/10 border-blue-400/20",
  paused:    "text-amber-400 bg-amber-400/10 border-amber-400/20",
  failed:    "text-red-400 bg-red-400/10 border-red-400/20",
};

const CONF_COLOR: Record<string, string> = {
  high:   "text-green-400",
  medium: "text-amber-400",
  low:    "text-slate-500",
};

const DECISION_COLOR: Record<string, string> = {
  scale:        "text-green-400",
  kill:         "text-red-400",
  continue:     "text-blue-400",
  inconclusive: "text-slate-500",
};

export default async function IntelligencePage() {
  const [health, cycleHistory, knowledgeEntries, experimentsAll] =
    await Promise.allSettled([
      fetchJSON<BusinessHealth>("/api/health/business"),
      fetchJSON<CycleRun[]>("/api/loop/history?limit=10"),
      fetchJSON<KnowledgeEntry[]>("/api/knowledge/insights?limit=12"),
      fetchJSON<ExperimentRow[]>("/api/experiments?limit=20"),
    ]);

  const h: BusinessHealth | null =
    health.status === "fulfilled" && !Array.isArray(health.value)
      ? (health.value as BusinessHealth)
      : null;
  const cycles: CycleRun[] =
    cycleHistory.status === "fulfilled" ? (cycleHistory.value as CycleRun[]) : [];
  const knowledge: KnowledgeEntry[] =
    knowledgeEntries.status === "fulfilled" ? (knowledgeEntries.value as KnowledgeEntry[]) : [];
  const experiments: ExperimentRow[] =
    experimentsAll.status === "fulfilled" ? (experimentsAll.value as ExperimentRow[]) : [];

  const expsEvaluated = experiments.filter((e) => e.status === "evaluated");
  const expsWon = expsEvaluated.filter((e) => {
    const o = e.outcome_json as any;
    return o?.decision === "scale";
  });
  const expsLost = expsEvaluated.filter((e) => {
    const o = e.outcome_json as any;
    return o?.decision === "kill";
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Machine Intelligence</h1>
        <p className="text-sm text-slate-500 mt-1">
          Qué aprendió el sistema · Experimentos · Ciclos · Revenue
        </p>
      </div>

      {/* ── Business KPIs ── */}
      {h && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
            Business Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPI label="Leads hoy" value={h.leads_today} />
            <KPI label="Leads 7d" value={h.leads_this_week} />
            <KPI label="Qualified 7d" value={h.qualified_leads_week} />
            <KPI label="Conv. rate 7d" value={`${h.conversion_rate_7d}%`} />
            <KPI label="Revenue 7d" value={`$${h.revenue_7d.toFixed(0)}`} />
            <KPI label="Cost hoy" value={`$${h.cost_today.toFixed(2)}`}
                 warn={h.budget_warning} />
            <KPI label="Budget left" value={`$${h.budget_remaining.toFixed(2)}`} />
            <KPI label="Error rate 24h" value={`${h.error_rate_24h}%`}
                 warn={h.error_rate_24h > 20} />
            <KPI label="Knowledge / sem" value={h.knowledge_entries_this_week} />
            <KPI label="Artículos / sem" value={h.articles_published_week} />
            {h.last_cycle_status && (
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 col-span-2">
                <p className="text-xs text-slate-500 mb-1">Último ciclo</p>
                <span className={`text-xs px-2 py-0.5 rounded border ${CYCLE_STATUS_COLOR[h.last_cycle_status] ?? "text-slate-400"}`}>
                  {h.last_cycle_status}
                </span>
                {h.last_cycle_at && (
                  <p className="text-xs text-slate-600 mt-1">
                    {new Date(h.last_cycle_at).toLocaleString("es-CO")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Highlight cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            {h.top_opportunity && (
              <HighlightCard label="Top oportunidad" text={h.top_opportunity} color="text-green-400" />
            )}
            {h.top_performing_asset_title && (
              <HighlightCard label="Mejor artículo" text={h.top_performing_asset_title} color="text-blue-400" />
            )}
            {h.worst_experiment && (
              <HighlightCard label="Experimento matado" text={h.worst_experiment} color="text-red-400" />
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Knowledge ── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
            Knowledge · {knowledge.length} insights
          </h2>
          <div className="space-y-2">
            {knowledge.length === 0 ? (
              <Empty text="Sin knowledge todavía" hint="Los insights aparecen tras evaluar experimentos" />
            ) : (
              knowledge.map((k) => (
                <div key={k.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 font-mono">{k.category}</span>
                    <span className={`text-xs font-medium ${CONF_COLOR[k.confidence] ?? "text-slate-400"}`}>
                      {k.confidence}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-snug">{k.insight}</p>
                  {k.metric_name && (
                    <p className="text-xs text-slate-500 mt-1">
                      {k.metric_name}: <span className="text-slate-300 font-mono">{k.metric_value}</span>
                      {k.sample_size ? ` · n=${k.sample_size}` : ""}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Experiments ── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
            Experiments · {expsWon.length} ganados · {expsLost.length} matados
          </h2>
          <div className="space-y-2">
            {expsEvaluated.length === 0 ? (
              <Empty text="Sin experimentos evaluados" hint="Los experimentos se evalúan al terminar su ventana" />
            ) : (
              expsEvaluated.slice(0, 8).map((exp) => {
                const o = exp.outcome_json as any;
                return (
                  <div key={exp.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-bold shrink-0 ${DECISION_COLOR[o?.decision ?? ""] ?? "text-slate-400"}`}>
                        {o?.decision ?? "?"}
                      </span>
                      <p className="text-xs text-slate-400 leading-snug line-clamp-2">{exp.hypothesis}</p>
                    </div>
                    {o?.improvement_pct !== undefined && (
                      <p className="text-xs text-slate-500 mt-1">
                        {o.improvement_pct > 0 ? "+" : ""}{o.improvement_pct}% · n={o.sample_size ?? "—"}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ── Cycle History ── */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Cycle History · {cycles.length} ciclos
        </h2>
        {cycles.length === 0 ? (
          <Empty text="Sin ciclos todavía" hint="POST /api/loop/run para iniciar el primer ciclo" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left pb-2 pr-4">Estado</th>
                  <th className="text-right pb-2 pr-4">Opps</th>
                  <th className="text-right pb-2 pr-4">Exps</th>
                  <th className="text-right pb-2 pr-4">Auto</th>
                  <th className="text-right pb-2 pr-4">Aprobación</th>
                  <th className="text-left pb-2">Inicio</th>
                  <th className="text-left pb-2">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cycles.map((c) => (
                  <tr key={c.id} className="text-slate-300">
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded border text-xs ${CYCLE_STATUS_COLOR[c.status] ?? "text-slate-400"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{c.opportunities_generated}</td>
                    <td className="py-2 pr-4 text-right font-mono">{c.experiments_created}</td>
                    <td className="py-2 pr-4 text-right font-mono text-green-400">{c.tasks_auto_run}</td>
                    <td className="py-2 pr-4 text-right font-mono text-amber-400">{c.tasks_queued_approval}</td>
                    <td className="py-2 pr-4 text-slate-500">
                      {new Date(c.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2 text-slate-600 truncate max-w-[200px]">
                      {c.kill_reason || c.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function KPI({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${warn ? "text-amber-400" : "text-slate-100"}`}>
        {value}
      </p>
    </div>
  );
}

function HighlightCard({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-sm font-medium ${color} leading-snug`}>{text}</p>
    </div>
  );
}

function Empty({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="text-center py-8 text-slate-600">
      <p className="text-sm">{text}</p>
      {hint && <p className="text-xs mt-1 font-mono text-slate-700">{hint}</p>}
    </div>
  );
}
