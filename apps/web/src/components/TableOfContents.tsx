"use client";
import { useEffect, useState } from "react";

interface Heading { id: string; text: string; level: number; }

export default function TableOfContents({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 3) return null;

  return (
    <nav aria-label="Tabla de contenido">
      <p className="font-ui text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3 px-1">
        Contenido
      </p>
      <ul className="space-y-0.5">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: h.level === 3 ? "1rem" : "0" }}>
            <a href={`#${h.id}`} className={`toc-link${active === h.id ? " active" : ""}`}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
