"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SITE_ID = process.env.NEXT_PUBLIC_SITE_ID || "";

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function genId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateVisitorId(): string {
  let vid = getCookie("_cv");
  if (!vid) {
    vid = genId();
    setCookie("_cv", vid, 365);
  }
  return vid;
}

function getOrCreateSessionId(): string {
  if (typeof sessionStorage === "undefined") return genId();
  let sid = sessionStorage.getItem("_cs");
  if (!sid) {
    sid = genId();
    sessionStorage.setItem("_cs", sid);
  }
  return sid;
}

// ─── Fire-and-forget API calls (never throw) ─────────────────────────────────

function post(path: string, body: object) {
  fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AttributionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionInitialized = useRef(false);

  useEffect(() => {
    if (!SITE_ID) return;

    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    const utmSource   = searchParams.get("utm_source")   ?? undefined;
    const utmMedium   = searchParams.get("utm_medium")   ?? undefined;
    const utmCampaign = searchParams.get("utm_campaign") ?? undefined;
    const utmContent  = searchParams.get("utm_content")  ?? undefined;

    // Once per browser session: register visitor + open session
    if (!sessionInitialized.current) {
      sessionInitialized.current = true;

      post("/api/tracking/visitor", {
        site_id: SITE_ID,
        fingerprint_hash: visitorId,
      });

      post("/api/tracking/session", {
        site_id: SITE_ID,
        visitor_id: visitorId,
        source:    utmSource,
        medium:    utmMedium,
        campaign:  utmCampaign,
        content:   utmContent,
        referrer:  typeof document !== "undefined" ? document.referrer || undefined : undefined,
        landed_on: pathname,
      });
    }

    // Every page navigation: page_view touchpoint
    // utm_content carries asset_id (set by content pipeline)
    post("/api/tracking/event", {
      site_id:    SITE_ID,
      session_id: sessionId,
      event_type: "page_view",
      asset_id:   utmContent,
      page_url:   pathname,
    });
  }, [pathname, searchParams]);

  return null;
}
