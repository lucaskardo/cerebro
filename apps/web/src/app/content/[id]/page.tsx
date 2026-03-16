import { api } from "@/lib/api";
import Link from "next/link";
import { notFound } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  generating: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  draft: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  review: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  approved: "text-green-400 bg-green-400/10 border-green-400/20",
  error: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default async function ContentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let item: Awaited<ReturnType<typeof api.contentItem>>;
  try {
    item = await api.contentItem(id);
  } catch {
    return notFound();
  }

  const fullItem = item as unknown as Record<string, unknown>;
  const validation = fullItem.validation_results as Record<string, unknown> | null;
  const checks = validation?.checks as Record<string, boolean> | undefined;
  const issues = validation?.issues as string[] | undefined;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/content" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
        ← Volver a contenido
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{item.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="font-mono">{item.keyword}</span>
            <span className="text-slate-700">·</span>
            <span>{item.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.quality_score != null && (
            <span
              className={`text-lg font-bold font-mono ${
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

      {/* Meta description */}
      {!!fullItem.meta_description && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Meta description</div>
          <p className="text-sm text-slate-300">{String(fullItem.meta_description)}</p>
          <div className="text-xs text-slate-600 mt-1">
            {String(fullItem.meta_description).length} chars
          </div>
        </div>
      )}

      {/* Validation checks */}
      {checks && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Validación</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(checks).map(([check, passed]) => (
              <div
                key={check}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                  passed ? "text-green-400 bg-green-400/5" : "text-red-400 bg-red-400/5"
                }`}
              >
                <span>{passed ? "✓" : "✗"}</span>
                <span>{check.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
          {issues && issues.length > 0 && (
            <div className="mt-3 text-xs text-red-400">
              Issues: {issues.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Article body */}
      {!!fullItem.body_md && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Contenido (Markdown)</h2>
          <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto max-h-[600px] overflow-y-auto">
            {String(fullItem.body_md)}
          </pre>
        </div>
      )}

      {/* FAQ */}
      {Array.isArray(fullItem.faq_section) && fullItem.faq_section.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">
            FAQ ({(fullItem.faq_section as unknown[]).length} preguntas)
          </h2>
          <div className="space-y-3">
            {(fullItem.faq_section as Array<{ question: string; answer: string }>).map(
              (faq, i) => (
                <div key={i} className="text-sm">
                  <div className="font-medium text-slate-300">Q: {faq.question}</div>
                  <div className="text-slate-500 mt-1 text-xs">A: {faq.answer}</div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Approve / Reject actions */}
      {item.status === "review" && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <p className="text-sm text-blue-300 font-medium mb-3">
            Este artículo está listo para revisión
          </p>
          <p className="text-xs text-slate-500">
            Para aprobar o rechazar, usa el endpoint:
          </p>
          <code className="block text-xs font-mono bg-slate-900 p-3 rounded mt-2 text-green-400">
            {`curl -X POST http://localhost:8000/api/content/${item.id}/review \\
  -H "Content-Type: application/json" \\
  -d '{"action": "approve"}'`}
          </code>
        </div>
      )}
    </div>
  );
}
