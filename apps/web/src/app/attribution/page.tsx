import { api } from "@/lib/api";

export default async function AttributionPage() {
  let funnel: Awaited<ReturnType<typeof api.funnel>> | null = null;
  let error: string | null = null;

  try {
    funnel = await api.funnel(30);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando atribución";
  }

  const steps = funnel
    ? [
        { label: "Pageviews", value: funnel.pageviews, color: "bg-blue-500" },
        { label: "Clicks", value: funnel.clicks, color: "bg-indigo-500" },
        { label: "Form starts", value: funnel.form_starts, color: "bg-violet-500" },
        { label: "Leads", value: funnel.leads_captured, color: "bg-green-500" },
        { label: "Conversiones", value: funnel.conversions, color: "bg-emerald-400" },
      ]
    : [];

  const maxVal = steps.reduce((m, s) => Math.max(m, s.value), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Atribución</h1>
        <p className="text-sm text-slate-500 mt-1">Últimos 30 días — tráfico → leads → conversiones</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {funnel && (
        <>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Funnel</h2>
            {steps.map((step) => (
              <div key={step.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{step.label}</span>
                  <span className="text-slate-300 font-mono">{step.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-3">
                  <div
                    className={`${step.color} h-3 rounded-full transition-all`}
                    style={{ width: `${Math.max(2, (step.value / maxVal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Leads capturados</div>
              <div className="text-3xl font-bold text-green-400">{funnel.leads_captured}</div>
              <div className="text-xs text-slate-600 mt-1">últimos {funnel.period_days} días</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Conversión</div>
              <div className="text-3xl font-bold text-blue-400">{funnel.conversion_rate}%</div>
              <div className="text-xs text-slate-600 mt-1">leads → clientes</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pageviews</div>
              <div className="text-3xl font-bold text-slate-300">{funnel.pageviews.toLocaleString()}</div>
              <div className="text-xs text-slate-600 mt-1">visitas totales</div>
            </div>
          </div>
        </>
      )}

      {!funnel && !error && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-sm">Sin datos de atribución todavía.</p>
        </div>
      )}
    </div>
  );
}
