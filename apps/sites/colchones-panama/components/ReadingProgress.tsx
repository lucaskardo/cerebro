"use client";
import { useEffect } from "react";

export default function ReadingProgress() {
  useEffect(() => {
    const bar = document.getElementById("reading-progress");
    if (!bar) return;

    const update = () => {
      const doc = document.documentElement;
      const scrolled = doc.scrollTop;
      const total = doc.scrollHeight - doc.clientHeight;
      const pct = total > 0 ? (scrolled / total) * 100 : 0;
      bar.style.width = `${pct}%`;
    };

    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return <div id="reading-progress" style={{ width: "0%" }} />;
}
