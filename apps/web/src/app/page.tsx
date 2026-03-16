import { api } from "@/lib/api";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  generating: "text-yellow-400 bg-yellow-400/10",
  draft: "text-slate-400 bg-slate-400/10",
  review: "text-blue-400 bg-blue-400/10",
  approved: "text-green-400 bg-green-400/10",
  error: "text-red-400 bg-red-400/10",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "border-blue-500/30 bg-blue-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  critical: "border-red-500/30 bg-red-500/5",
};

function StatCard({
  label,
  value,
  sub,
  color = "text-slate-100",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default async function Dashboard() {
  let status: Awaited<ReturnType<typeof api.status>> | null = null;
  let alerts: Awaited<ReturnType<typeof api.alerts>> = [];
  let recentContent: Awaited<ReturnType<typeof api.content>> = [];
  let error: string | null = null;

  try {
    [status, alerts, recentContent] = await Promise.all([
      api.status(),
      api.alerts(),
      api.content(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "API unreachable";
    status = null;
    alerts = [];
    recentContent = [];
  }

  const totalContent = status
    ? Object.values(status.content).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          CEREBRO v7 — Sprint 1 | ikigii Colombia
        </p>
      </div>

      {/* API Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          ⚠ API no disponible: {error}. Asegúrate de correr{" "}
          <code className="font-mono bg-red-500/10 px-1 rounded">
            cd apps/api && uvicorn app.main:app --reload
          </code>
        </div>
      )}

      {/* Budget */}
      {status && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Budget LLM hoy
            </span>
            <span
              className={`text-xs font-mono ${
                status.budget.blocked
                  ? "text-red-400"
                  : status.budget.warning
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              ${status.budget.spent.toFixed(4)} / ${status.budget.limit.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                status.budget.blocked
                  ? "bg-red-500"
                  : status.budget.warning
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${Math.min(100, status.budget.percent)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-slate-600">{status.budget.percent.toFixed(1)}% usado</span>
            <span className="text-xs text-slate-600">
              ${status.budget.remaining.toFixed(4)} restante
            </span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Artículos totales"
          value={totalContent}
          sub="en pipeline"
        />
        <StatCard
          label="Para revisar"
          value={status?.content?.review ?? 0}
          sub="pendientes aprobación"
          color="text-blue-400"
        />
        <StatCard
          label="Aprobados"
          value={status?.content?.approved ?? 0}
          sub="listos para publicar"
          color="text-green-400"
        />
        <StatCard
          label="Leads hoy"
          value={status?.leads_today ?? 0}
          sub="capturados hoy"
          color="text-purple-400"
        />
      </div>

      {/* Content status breakdown */}
      {status && Object.keys(status.content).length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Estado del contenido</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(status.content).map(([s, count]) => (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  STATUS_COLORS[s] ?? "text-slate-400 bg-slate-700"
                }`}
              >
                {s} <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-300 mb-3">
            Alertas ({alerts.length})
          </h2>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`border rounded-lg p-3 text-sm ${
                  SEVERITY_COLORS[alert.severity] ?? "border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-300">{alert.alert_type}</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="text-slate-400">{alert.message}</span>
                  </div>
                  {alert.action_url && (
                    <Link
                      href={alert.action_url}
                      className="shrink-0 text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {alert.action_label ?? "Ver"}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent content */}
      {recentContent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-300">Contenido reciente</h2>
            <Link href="/content" className="text-xs text-blue-400 hover:text-blue-300">
              Ver todo →
            </Link>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">
                    Título
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium hidden md:table-cell">
                    Keyword
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">
                    Estado
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">
                    Calidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentContent.slice(0, 10).map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/content/${item.id}`}
                        className="text-slate-200 hover:text-white font-medium line-clamp-1"
                      >
                        {item.title.replace("[GENERATING] ", "")}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                      {item.keyword}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[item.status] ?? "text-slate-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono">
                      {item.quality_score != null ? (
                        <span
                          className={
                            item.quality_score >= 80
                              ? "text-green-400"
                              : item.quality_score >= 60
                              ? "text-yellow-400"
                              : "text-red-400"
                          }
                        >
                          {item.quality_score}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feature flags */}
      {status && (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
          <h2 className="text-xs text-slate-600 uppercase tracking-wide mb-3">Feature Flags</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(status.features).map(([flag, enabled]) => (
              <div key={flag} className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    enabled ? "bg-green-500" : "bg-slate-600"
                  }`}
                />
                <span className={enabled ? "text-slate-300" : "text-slate-600"}>
                  {flag.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
