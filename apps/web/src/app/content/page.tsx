import { api } from "@/lib/api";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  generating: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  draft: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  review: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  approved: "text-green-400 bg-green-400/10 border-green-400/20",
  error: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default async function ContentPage() {
  let items: Awaited<ReturnType<typeof api.content>> = [];
  let error: string | null = null;

  try {
    items = await api.content();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error";
    items = [];
  }

  const grouped = items.reduce(
    (acc, item) => {
      const s = item.status;
      if (!acc[s]) acc[s] = [];
      acc[s].push(item);
      return acc;
    },
    {} as Record<string, typeof items>
  );

  const statusOrder = ["review", "approved", "draft", "generating", "error"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Contenido</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} artículos en pipeline</p>
        </div>
        <div className="flex gap-2">
          {statusOrder.map(
            (s) =>
              grouped[s] && (
                <span
                  key={s}
                  className={`text-xs px-2 py-1 rounded border font-medium ${
                    STATUS_COLORS[s] ?? "text-slate-400"
                  }`}
                >
                  {grouped[s].length} {s}
                </span>
              )
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {statusOrder.map((status) => {
        const group = grouped[status];
        if (!group) return null;
        return (
          <div key={status}>
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              {status} ({group.length})
            </h2>
            <div className="space-y-2">
              {group.map((item) => (
                <Link
                  key={item.id}
                  href={`/content/${item.id}`}
                  className="block bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all hover:bg-slate-800/80"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 truncate">
                        {item.title.replace("[GENERATING] ", "")}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span className="font-mono">{item.keyword}</span>
                        <span className="text-slate-700">·</span>
                        <span>{new Date(item.created_at).toLocaleDateString("es-CO")}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      {item.quality_score != null && (
                        <span
                          className={`text-sm font-bold font-mono ${
                            item.quality_score >= 80
                              ? "text-green-400"
                              : item.quality_score >= 60
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {item.quality_score}%
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded border font-medium ${
                          STATUS_COLORS[item.status] ?? "text-slate-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && !error && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-4xl mb-4">📝</div>
          <p className="text-sm">No hay artículos todavía.</p>
          <p className="text-xs mt-2">
            Corre{" "}
            <code className="font-mono bg-slate-800 px-1 rounded">
              python3 scripts/generate_sprint1.py
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
