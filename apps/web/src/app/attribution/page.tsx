import { api, Funnel, BusinessHealth, LeadsByAsset, LeadsByBrand, LeadsByCta, RevenueByAsset, Site } from "@/lib/api";

export default async function AttributionPage() {
  const days = 30;

  const [funnelRes, healthRes, byAssetRes, byBrandRes, byCtaRes, revenueRes, sitesRes] =
    await Promise.allSettled([
      api.funnelNew(days),
      api.businessHealth(),
      api.leadsByAsset(days),
      api.leadsByBrand(days),
      api.leadsByCta(days),
      api.revenueByAsset(),
      api.sites(),
    ]);

  const funnel = funnelRes.status === "fulfilled" ? funnelRes.value : null;
  const health = healthRes.status === "fulfilled" ? healthRes.value : null;
  const byAsset = byAssetRes.status === "fulfilled" ? byAssetRes.value : [];
  const byBrand = byBrandRes.status === "fulfilled" ? byBrandRes.value : [];
  const byCta = byCtaRes.status === "fulfilled" ? byCtaRes.value : [];
  const revenue = revenueRes.status === "fulfilled" ? revenueRes.value : [];
  const sites: Site[] = sitesRes.status === "fulfilled" ? sitesRes.value : [];

  const siteMap = Object.fromEntries(sites.map((s) => [s.id, s.brand_name || s.domain]));

  // Funnel steps from new spine
  const funnelSteps = funnel
    ? [
        { label: "Visitantes únicos", value: funnel.visitors ?? 0, color: "bg-blue-500" },
        { label: "Sesiones", value: funnel.sessions ?? 0, color: "bg-indigo-500" },
        { label: "Leads capturados", value: funnel.leads ?? 0, color: "bg-violet-500" },
        { label: "Calificados", value: funnel.qualified ?? 0, color: "bg-green-500" },
        { label: "Aceptados", value: funnel.accepted ?? 0, color: "bg-emerald-400" },
      ]
    : [];

  const maxVal = funnelSteps.reduce((m, s) => Math.max(m, s.value), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Atribución</h1>
        <p className="text-sm text-slate-500 mt-1">Últimos {days} días — tráfico → leads → conversiones</p>
      </div>

      {/* Business Health KPIs */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPI label="Leads hoy" value={health.leads_today} color="text-green-400" />
          <KPI label="Leads esta semana" value={health.leads_this_week} color="text-blue-400" />
          <KPI label="Artículos publicados" value={health.articles_published_week} sub="esta semana" color="text-slate-300" />
          <KPI
            label="Budget restante"
            value={`$${health.budget_remaining.toFixed(2)}`}
            color={health.budget_warning ? "text-yellow-400" : "text-slate-300"}
            sub={health.budget_warning ? "⚠ alerta activa" : "hoy"}
          />
        </div>
      )}

      {/* Funnel */}
      {funnel && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Funnel de conversión</h2>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>Tasa lead: <span className="text-slate-300 font-mono">{funnel.lead_rate ?? 0}%</span></span>
              <span>Tasa calif.: <span className="text-slate-300 font-mono">{funnel.qualify_rate ?? 0}%</span></span>
            </div>
          </div>
          {funnelSteps.map((step, i) => {
            const prev = i > 0 ? funnelSteps[i - 1].value : step.value;
            const dropoff = prev > 0 ? Math.round((1 - step.value / prev) * 100) : 0;
            return (
              <div key={step.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{step.label}</span>
                  <span className="text-slate-300 font-mono">
                    {step.value.toLocaleString()}
                    {i > 0 && prev > 0 && (
                      <span className="ml-2 text-slate-600">−{dropoff}%</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                  <div
                    className={`${step.color} h-2.5 rounded-full transition-all`}
                    style={{ width: `${Math.max(2, (step.value / maxVal) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4 Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por marca */}
        <TableCard title="Leads por marca" subtitle="sitios activos">
          {byBrand.length === 0 ? (
            <EmptyRow />
          ) : (
            byBrand.slice(0, 8).map((row) => (
              <tr key={row.site_id} className="border-t border-slate-700/30">
                <td className="py-2 pr-4 text-sm text-slate-300 truncate max-w-[160px]">
                  {siteMap[row.site_id] || row.site_id.slice(0, 8)}
                </td>
                <td className="py-2 px-2 text-sm font-mono text-right text-slate-200">{row.total}</td>
                <td className="py-2 pl-2 text-sm font-mono text-right text-green-400">{row.qualified}</td>
              </tr>
            ))
          )}
        </TableCard>

        {/* Por CTA */}
        <TableCard title="Leads por CTA" subtitle="variante de formulario">
          {byCta.length === 0 ? (
            <EmptyRow />
          ) : (
            byCta.slice(0, 8).map((row) => (
              <tr key={row.cta_variant} className="border-t border-slate-700/30">
                <td className="py-2 pr-4 text-sm text-slate-300 truncate max-w-[160px]">{row.cta_variant}</td>
                <td className="py-2 px-2 text-sm font-mono text-right text-slate-200">{row.total}</td>
                <td className="py-2 pl-2 text-sm font-mono text-right text-green-400">{row.qualified}</td>
              </tr>
            ))
          )}
        </TableCard>

        {/* Por artículo */}
        <TableCard title="Leads por artículo" subtitle="asset_id · total · calificados">
          {byAsset.length === 0 ? (
            <EmptyRow />
          ) : (
            byAsset.slice(0, 8).map((row) => (
              <tr key={row.asset_id} className="border-t border-slate-700/30">
                <td className="py-2 pr-4 text-sm text-slate-400 font-mono truncate max-w-[160px]">
                  {row.asset_id.slice(0, 8)}…
                </td>
                <td className="py-2 px-2 text-sm font-mono text-right text-slate-200">{row.total}</td>
                <td className="py-2 pl-2 text-sm font-mono text-right text-green-400">{row.qualified}</td>
              </tr>
            ))
          )}
        </TableCard>

        {/* Revenue por artículo */}
        <TableCard title="Revenue por artículo" subtitle="ingresos atribuidos">
          {revenue.length === 0 ? (
            <EmptyRow />
          ) : (
            revenue.slice(0, 8).map((row) => (
              <tr key={row.asset_id} className="border-t border-slate-700/30">
                <td className="py-2 pr-4 text-sm text-slate-400 font-mono truncate max-w-[160px]">
                  {row.asset_id.slice(0, 8)}…
                </td>
                <td className="py-2 pl-2 text-sm font-mono text-right text-emerald-400">
                  ${row.revenue.toLocaleString("es", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))
          )}
        </TableCard>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}

function TableCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <h2 className="text-sm font-medium text-slate-300 mb-0.5">{title}</h2>
      <p className="text-xs text-slate-600 mb-4">{subtitle}</p>
      <table className="w-full">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow() {
  return (
    <tr>
      <td className="py-4 text-center text-slate-600 text-sm" colSpan={3}>
        Sin datos todavía
      </td>
    </tr>
  );
}
