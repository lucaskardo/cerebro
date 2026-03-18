"use client";

interface Props {
  data: Record<string, unknown>[];
  filename?: string;
  label?: string;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export default function ExportCSV({ data, filename = "export.csv", label = "Export CSV" }: Props) {
  const download = () => {
    const csv = toCSV(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={download}
      disabled={data.length === 0}
      style={{
        padding: "0.35rem 0.75rem",
        background: "transparent",
        border: "1px solid var(--dash-border-hi)",
        borderRadius: "5px",
        color: "var(--dash-text-dim)",
        fontSize: "0.6875rem",
        cursor: data.length === 0 ? "not-allowed" : "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        opacity: data.length === 0 ? 0.4 : 1,
        whiteSpace: "nowrap",
      }}
    >
      ↓ {label}
    </button>
  );
}
