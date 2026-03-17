"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Site } from "@/lib/api";

const BRAND_COLORS: Record<string, string> = {
  "dolarafuera.co": "text-green-400 bg-green-400/10 border-green-400/30",
  "mudateapanama.com": "text-blue-400 bg-blue-400/10 border-blue-400/30",
  "dolarizate.co": "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  "remesas.co": "text-orange-400 bg-orange-400/10 border-orange-400/30",
};

interface Props {
  sites: Site[];
}

export default function BrandSelector({ sites }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("brand") || "all";

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("brand");
    } else {
      params.set("brand", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const allOption = (
    <button
      key="all"
      onClick={() => select("all")}
      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
        current === "all"
          ? "text-slate-100 bg-slate-700 border-slate-600"
          : "text-slate-500 bg-transparent border-slate-800 hover:border-slate-600"
      }`}
    >
      Todas
    </button>
  );

  const siteButtons = sites.map((s) => {
    const isActive = current === s.id;
    const colorClass = BRAND_COLORS[s.domain] || "text-slate-400 bg-slate-400/10 border-slate-400/30";
    return (
      <button
        key={s.id}
        onClick={() => select(s.id)}
        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
          isActive ? colorClass : "text-slate-500 bg-transparent border-slate-800 hover:border-slate-600"
        }`}
        title={s.brand_persona || s.domain}
      >
        {s.brand_name || s.domain}
      </button>
    );
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-600 mr-1">Marca:</span>
      {allOption}
      {siteButtons}
    </div>
  );
}
