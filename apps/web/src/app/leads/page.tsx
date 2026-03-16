import { api } from "@/lib/api";

export default async function LeadsPage() {
  let leads: Awaited<ReturnType<typeof api.leads>> = [];
  let error: string | null = null;

  try {
    leads = await api.leads();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error";
    leads = [];
  }

  const highIntent = leads.filter((l) => l.intent_score >= 7);
  const mediumIntent = leads.filter((l) => l.intent_score >= 4 && l.intent_score < 7);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Leads</h1>
        <p className="text-sm text-slate-500 mt-1">{leads.length} leads capturados</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Total</div>
          <div className="text-2xl font-bold text-slate-100">{leads.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Alto intent (≥7)</div>
          <div className="text-2xl font-bold text-green-400">{highIntent.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Medio intent (4-6)</div>
          <div className="text-2xl font-bold text-yellow-400">{mediumIntent.length}</div>
        </div>
      </div>

      {/* Table */}
      {leads.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium hidden md:table-cell">Nombre</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium hidden md:table-cell">Fuente</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Tema</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Score</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-200 font-mono text-xs">{lead.email}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                    {lead.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                    {lead.utm_source ?? "directo"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{lead.tema_interes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-xs font-bold font-mono ${
                        lead.intent_score >= 7
                          ? "text-green-400"
                          : lead.intent_score >= 4
                          ? "text-yellow-400"
                          : "text-slate-500"
                      }`}
                    >
                      {lead.intent_score}/10
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-600">
                    {new Date(lead.created_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !error && (
          <div className="text-center py-16 text-slate-600">
            <div className="text-4xl mb-4">📧</div>
            <p className="text-sm">No hay leads todavía.</p>
            <p className="text-xs mt-2">
              Usa el endpoint{" "}
              <code className="font-mono bg-slate-800 px-1 rounded">POST /api/leads/capture</code>{" "}
              para capturar leads.
            </p>
          </div>
        )
      )}
    </div>
  );
}
