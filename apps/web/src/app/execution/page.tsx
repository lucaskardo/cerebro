import { api, Opportunity, Experiment, Task } from "@/lib/api";
import ApprovalQueue from "@/components/ApprovalQueue";

// ─── Status badges ────────────────────────────────────────────────────────────
const EXEC_STATUS_COLOR: Record<string, string> = {
  detected: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  evaluated: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  planned: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  executing: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  measured: "text-green-400 bg-green-400/10 border-green-400/20",
};

const EXP_STATUS_COLOR: Record<string, string> = {
  planned: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  running: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  evaluated: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  winner_declared: "text-green-400 bg-green-400/10 border-green-400/20",
  archived: "text-slate-600 bg-slate-600/10 border-slate-600/20",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  pending: "text-slate-400",
  running: "text-blue-400",
  completed: "text-green-400",
  failed: "text-red-400",
  retrying: "text-amber-400",
  dead_lettered: "text-red-600",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  low: "text-red-400",
  medium: "text-amber-400",
  high: "text-green-400",
};

const CHANNEL_ICON: Record<string, string> = {
  seo: "🔍", social: "📱", community: "💬", email: "✉️",
  outreach: "🤝", conversion: "🎯", messaging: "📩",
};

const EXEC_STAGES = ["detected", "evaluated", "planned", "executing", "measured"] as const;

export default async function ExecutionPage() {
  const [oppsRes, experimentsRes, tasksRes, approvalsRes, knowledgeRes] =
    await Promise.allSettled([
      api.opportunities(),
      api.experiments(),
      api.tasks({ limit: 30 }),
      api.approvals("pending"),
      api.goals().then((goals) =>
        goals.length > 0
          ? fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/knowledge/insights?limit=6`)
              .then((r) => r.json())
              .catch(() => [])
          : Promise.resolve([])
      ),
    ]);

  const opps: Opportunity[] = oppsRes.status === "fulfilled" ? oppsRes.value : [];
  const experiments: Experiment[] = experimentsRes.status === "fulfilled" ? experimentsRes.value : [];
  const tasks: Task[] = tasksRes.status === "fulfilled" ? tasksRes.value : [];
  const approvals = approvalsRes.status === "fulfilled" ? approvalsRes.value : [];
  const insights = knowledgeRes.status === "fulfilled" ? (knowledgeRes.value as any[]) : [];

  // Group opportunities by execution_status
  const oppsByStage = EXEC_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = opps.filter((o) => o.execution_status === stage);
      return acc;
    },
    {} as Record<string, Opportunity[]>
  );

  // Task summary counts
  const taskCounts = tasks.reduce(
    (acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Execution Engine</h1>
        <p className="text-sm text-slate-500 mt-1">
          Opportunities → Experiments → Tasks → Knowledge
        </p>
      </div>

      {/* ── Opportunities Pipeline (kanban-style) ── */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Opportunities Pipeline · {opps.length} total
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {EXEC_STAGES.map((stage) => {
            const items = oppsByStage[stage] || [];
            return (
              <div key={stage} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded border ${EXEC_STATUS_COLOR[stage]}`}>
                    {stage}
                  </span>
                  <span className="text-xs text-slate-600 font-mono">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 5).map((opp) => (
                    <div
                      key={opp.id}
                      className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30"
                    >
                      <div className="flex items-start gap-1.5 mb-1">
                        <span className="text-sm">{CHANNEL_ICON[opp.channel] ?? "⚡"}</span>
                        <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                          {opp.query || opp.pain_point || "—"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${CONFIDENCE_COLOR[opp.confidence]}`}>
                          {opp.confidence}
                        </span>
                        {opp.expected_value > 0 && (
                          <span className="text-xs text-slate-500">
                            ~{opp.expected_value} leads
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length > 5 && (
                    <p className="text-xs text-slate-600 text-center">
                      +{items.length - 5} más
                    </p>
                  )}
                  {items.length === 0 && (
                    <p className="text-xs text-slate-700 text-center py-2">vacío</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Active Experiments ── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
            Experiments · {experiments.length}
          </h2>
          <div className="space-y-3">
            {experiments.length === 0 ? (
              <EmptyState text="No hay experimentos todavía" hint="POST /api/experiments" />
            ) : (
              experiments.slice(0, 8).map((exp) => {
                const outcome = exp.outcome_json as any;
                return (
                  <div
                    key={exp.id}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-slate-200 leading-snug flex-1">
                        {exp.hypothesis}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${EXP_STATUS_COLOR[exp.status] ?? "text-slate-400"}`}>
                        {exp.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {exp.target_metric && <span>metric: {exp.target_metric}</span>}
                      <span>n={exp.visits_a + exp.visits_b}</span>
                      {exp.run_window_days && <span>{exp.run_window_days}d window</span>}
                    </div>
                    {outcome?.decision && (
                      <div className="mt-2 text-xs">
                        <span className={`font-semibold ${
                          outcome.decision === "scale" ? "text-green-400" :
                          outcome.decision === "kill" ? "text-red-400" :
                          "text-slate-400"
                        }`}>
                          {outcome.decision}
                        </span>
                        <span className="text-slate-500 ml-1">— {outcome.rationale}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Tasks ── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
            Tasks · {tasks.length}
          </h2>
          {/* Summary counts */}
          <div className="flex gap-3 mb-4 flex-wrap">
            {Object.entries(taskCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`text-xs font-mono font-bold ${TASK_STATUS_COLOR[status]}`}>
                  {count}
                </span>
                <span className="text-xs text-slate-600">{status}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState text="No hay tasks todavía" hint="POST /api/tasks" />
            ) : (
              tasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-800/40 border border-slate-700/30 rounded-lg px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.status === "completed" ? "bg-green-400" :
                      t.status === "running" ? "bg-blue-400" :
                      t.status === "failed" || t.status === "dead_lettered" ? "bg-red-400" :
                      t.status === "retrying" ? "bg-amber-400" : "bg-slate-600"
                    }`} />
                    <span className="text-xs text-slate-300 font-mono truncate">
                      {t.skill_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs ${TASK_STATUS_COLOR[t.status]}`}>{t.status}</span>
                    {t.attempts > 0 && (
                      <span className="text-xs text-slate-600">×{t.attempts}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Pending Approvals ── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
            Aprobaciones pendientes · {approvals.length}
          </h2>
          <ApprovalQueue initialApprovals={approvals} />
        </section>

        {/* ── Knowledge Insights ── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
            Knowledge · top insights
          </h2>
          <div className="space-y-3">
            {insights.length === 0 ? (
              <EmptyState text="Sin knowledge todavía" hint="Los insights aparecen tras evaluar experimentos" />
            ) : (
              insights.slice(0, 6).map((k: any) => (
                <div
                  key={k.id}
                  className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs text-slate-500 font-mono">{k.category}</span>
                    <span className={`text-xs font-medium shrink-0 ${CONFIDENCE_COLOR[k.confidence] ?? "text-slate-400"}`}>
                      {k.confidence}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-snug">{k.insight}</p>
                  {k.metric_name && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{k.metric_name}: <span className="text-slate-300 font-mono">{k.metric_value}</span></span>
                      {k.sample_size && <span>n={k.sample_size}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="text-center py-8 text-slate-600">
      <p className="text-sm">{text}</p>
      {hint && <p className="text-xs mt-1 font-mono text-slate-700">{hint}</p>}
    </div>
  );
}
