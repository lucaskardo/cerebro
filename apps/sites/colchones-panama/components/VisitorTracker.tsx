"use client";
import { useEffect } from "react";
import { trackVisitor, trackSession } from "@/lib/api";

function getOrCreateFingerprint(): string {
  if (typeof window === "undefined") return "";
  const key = "cp_vid";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
    // Also set cookie for server-side use
    document.cookie = `cp_vid=${id}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  }
  return id;
}

export default function VisitorTracker() {
  useEffect(() => {
    const fp = getOrCreateFingerprint();
    if (!fp) return;
    trackVisitor(fp);
    trackSession({
      visitor_fingerprint: fp,
      page_url: window.location.href,
      referrer: document.referrer || undefined,
    });
  }, []);

  return null;
}
