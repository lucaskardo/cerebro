const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";
const KEY = process.env.API_SECRET_KEY || "";

async function fetchAuth<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { "x-api-key": KEY },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

interface CycleRun {
  id: string;
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

interface KnowledgeInsight {
  id: string;
  category: string;
  insight: string;
  confidence: number | string;
  evidence?: Record<string, unknown>;
  metric_name?: string | null;
  metric_value?: number | null;
  sample_size?: number | null;
  created_at: string;
}

interface LoopStatus {
  scheduler_enabled?: boolean;
  last_cycle?: {
    id?: string;
    status?: string;
    completed_at?: string | null;
    created_at?: string | null;
  } | null;
  running?: boolean;
}

interface BusinessHealthExtended {
  leads_today?: number;
  leads_this_week?: number;
  knowledge_entries_this_week?: number;
  last_cycle_at?: string | null;
  last_cycle_status?: string | null;
  [key: string]: unknown;
}

const CYCLE_STATUS_STYLE: Record<string, string> = {
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  running:   "text-blue-400 bg-blue-400/10 border-blue-400/30",
  paused:    "text-amber-400 bg-amber-400/10 border-amber-400/30",
  failed:    "text-red-400 bg-red-400/10 border-red-400/30",
};

const CATEGORY_BADGE: Record<string, string> = {
  content:    "text-blue-400 bg-blue-400/10 border-blue-400/30",
  channel:    "text-green-400 bg-green-400/10 border-green-400/30",
  audience:   "text-amber-400 bg-amber-400/10 border-amber-400/30",
  conversion: "text-green-400 bg-green-400/10 border-green-400/30",
};

function parseConfidence(raw: number | string | undefined): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === "number") {
    // If stored as 0–1 float, scale to 0–100
    return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  }
  const n = parseFloat(String(raw));
  return isNaN(n) ? 0 : n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function IntelligenceDashboardPage() {
  const [health, insights, history, loopStatus] = await Promise.allSettled([
    fetchPublic<BusinessHealthExtended>("/api/health/business"),
    fetchAuth<KnowledgeInsight[]>("/api/knowledge/insights?limit=15"),
    fetchAuth<CycleRun[]>("/api/loop/history?limit=20"),
    fetchPublic<LoopStatus>("/api/loop/status"),
  ]);

  const h: BusinessHealthExtended | null =
    health.status === "fulfilled" ? health.value : null;

  const knowledgeRaw: KnowledgeInsight[] =
    insights.status === "fulfilled" && Array.isArray(insights.value)
      ? insights.value
      : [];

  const knowledge = [...knowledgeRaw].sort(
    (a, b) => parseConfidence(b.confidence) - parseConfidence(a.confidence)
  );

  const cycles: CycleRun[] =
    history.status === "fulfilled" && Array.isArray(history.value)
      ? history.value
      : [];

  const loop: LoopStatus | null =
    loopStatus.status === "fulfilled" ? loopStatus.value : null;

  const schedulerEnabled = loop?.scheduler_enabled ?? false;
  const lastCycle = loop?.last_cycle ?? null;

  const topConfidence =
    knowledge.length > 0 ? parseConfidence(knowledge[0].confidence) : null;

  const experimentsEvaluated = cycles.reduce(
    (sum, c) => sum + (c.experiments_created ?? 0),
    0
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Intelligence</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sistema de aprendizaje continuo
        </p>
      </div>

      {/* Loop status banner */}
      <div
        style={{
          padding: "0.875rem 1.25rem",
          borderRadius: "0.875rem",
          border: "1px solid",
          borderColor: schedulerEnabled
            ? "rgba(0, 217, 126, 0.3)"
            : "var(--dash-border)",
          background: schedulerEnabled
            ? "rgba(0, 217, 126, 0.06)"
            : "rgba(100, 116, 139, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap" as const,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            style={{
              width: "0.625rem",
              height: "0.625rem",
              borderRadius: "50%",
              background: schedulerEnabled ? "var(--dash-accent)" : "#64748b",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: "0.875rem",
              color: schedulerEnabled ? "var(--dash-accent)" : "#64748b",
            }}
          >
            {schedulerEnabled ? "Loop activo" : "Loop pausado"}
          </span>
        </div>
        {lastCycle && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {lastCycle.status && (
              <span
                className={`px-2 py-0.5 rounded border text-xs ${
                  CYCLE_STATUS_STYLE[lastCycle.status] ??
                  "text-slate-400 border-slate-700"
                }`}
              >
                {lastCycle.status}
              </span>
            )}
            {lastCycle.completed_at && (
              <span>Último ciclo: {fmtDate(lastCycle.completed_at)}</span>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Knowledge entries" value={knowledge.length} />
        <Stat
          label="Último ciclo"
          value={
            h?.last_cycle_at
              ? fmtDate(h.last_cycle_at as string)
              : lastCycle?.completed_at
              ? fmtDate(lastCycle.completed_at)
              : "—"
          }
        />
        <Stat label="Experimentos evaluados" value={experimentsEvaluated} />
        <Stat
          label="Top confidence"
          value={topConfidence !== null ? `${topConfidence}%` : "—"}
          accent={topConfidence !== null && topConfidence >= 70}
        />
      </div>

      {/* Knowledge Insights */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Lo que el sistema ha aprendido
        </h2>

        {knowledge.length === 0 ? (
          <div className="text-center py-10 text-slate-600">
            <p className="text-sm">Sin insights todavía</p>
            <p className="text-xs mt-1 font-mono text-slate-700">
              Los insights aparecen tras evaluar experimentos
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {knowledge.map((k) => {
              const conf = parseConfidence(k.confidence);
              const evidenceCount = k.evidence
                ? Object.keys(k.evidence).length
                : 0;
              return (
                <div
                  key={k.id}
                  className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 flex flex-col gap-2"
                >
                  {/* Category badge + confidence % */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border font-medium ${
                        CATEGORY_BADGE[k.category] ??
                        "text-slate-400 bg-slate-400/10 border-slate-400/30"
                      }`}
                    >
                      {k.category}
                    </span>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        conf >= 70
                          ? "text-green-400"
                          : conf >= 40
                          ? "text-amber-400"
                          : "text-slate-500"
                      }`}
                    >
                      {conf}%
                    </span>
                  </div>

                  {/* Insight text */}
                  <p className="text-sm text-slate-300 leading-snug">
                    {k.insight}
                  </p>

                  {/* Evidence count */}
                  {evidenceCount > 0 && (
                    <p className="text-xs text-slate-600">
                      {evidenceCount} evidencia{evidenceCount !== 1 ? "s" : ""}
                    </p>
                  )}

                  {/* Confidence bar */}
                  <div
                    style={{
                      height: "3px",
                      borderRadius: "2px",
                      background: "var(--dash-border)",
                      overflow: "hidden",
                      marginTop: "0.25rem",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(conf, 100)}%`,
                        borderRadius: "2px",
                        background:
                          conf >= 70
                            ? "var(--dash-accent)"
                            : conf >= 40
                            ? "#f59e0b"
                            : "#64748b",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Cycle History */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Ciclos recientes
          {cycles.length > 0 && (
            <span className="text-slate-600 normal-case font-normal ml-2">
              · {cycles.length} ciclos
            </span>
          )}
        </h2>

        {cycles.length === 0 ? (
          <div className="text-center py-10 text-slate-600">
            <p className="text-sm">Sin ciclos todavía</p>
            <p className="text-xs mt-1 font-mono text-slate-700">
              POST /api/loop/run para iniciar el primer ciclo
            </p>
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">
                      Iniciado
                    </th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">
                      Estado
                    </th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">
                      Opps
                    </th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">
                      Experiments
                    </th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">
                      Auto-run
                    </th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">
                      En cola
                    </th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">
                      Kill reason
                    </th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">
                      Duración
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                    >
                      {/* Started at */}
                      <td className="px-4 py-3 text-slate-500">
                        {fmtDate(c.created_at)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            CYCLE_STATUS_STYLE[c.status] ??
                            "text-slate-400 border-slate-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* Opps generated */}
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {c.opportunities_generated}
                      </td>

                      {/* Experiments created */}
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {c.experiments_created}
                      </td>

                      {/* Auto-run */}
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        {c.tasks_auto_run}
                      </td>

                      {/* Queued for approval */}
                      <td className="px-4 py-3 text-right font-mono text-amber-400">
                        {c.tasks_queued_approval}
                      </td>

                      {/* Kill reason */}
                      <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]">
                        {c.kill_reason ? (
                          <span className="text-red-400 truncate block">
                            {c.kill_reason}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {formatDuration(c.created_at, c.completed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div
        className={`text-xl font-bold font-mono leading-tight ${
          accent ? "text-green-400" : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
