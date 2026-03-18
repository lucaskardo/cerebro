"use client";
import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <nav aria-label="Tabla de contenidos">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-600 dark:text-accent-400 mb-3">
        En este artículo
      </p>
      <ul className="space-y-1.5">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: h.level === 3 ? "0.75rem" : "0" }}>
            <a
              href={`#${h.id}`}
              className={`text-sm leading-snug transition-colors block py-0.5 ${
                active === h.id
                  ? "text-accent-600 dark:text-accent-400 font-semibold"
                  : "text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-text-dark"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
