"use client";

import { useState } from "react";
import { Approval } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ApprovalQueue({ initialApprovals }: { initialApprovals: Approval[] }) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [loading, setLoading] = useState<string | null>(null);

  async function resolve(id: string, action: "approve" | "reject") {
    setLoading(id);
    try {
      const res = await fetch(`${API_URL}/api/approvals/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setLoading(null);
    }
  }

  if (approvals.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600 text-sm">
        No hay aprobaciones pendientes
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((a) => (
        <div
          key={a.id}
          className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-4 flex items-start justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-mono">
                {a.entity_type}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {a.entity_id?.slice(0, 8)}
              </span>
            </div>
            <p className="text-sm text-slate-300 font-medium">{a.action}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Solicitado por {a.requested_by} ·{" "}
              {new Date(a.created_at).toLocaleDateString("es-CO")}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              disabled={loading === a.id}
              onClick={() => resolve(a.id, "approve")}
              className="text-xs px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg transition-colors disabled:opacity-40"
            >
              ✓ Aprobar
            </button>
            <button
              disabled={loading === a.id}
              onClick={() => resolve(a.id, "reject")}
              className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-40"
            >
              ✕ Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
