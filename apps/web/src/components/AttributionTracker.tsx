"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let vid = localStorage.getItem("cerebro_vid");
  if (!vid) {
    vid = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("cerebro_vid", vid);
  }
  return vid;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("cerebro_sid");
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem("cerebro_sid", sid);
  }
  return sid;
}

export default function AttributionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const utmSource = searchParams.get("utm_source");
    const utmMedium = searchParams.get("utm_medium");
    const utmCampaign = searchParams.get("utm_campaign");

    // Determine channel from UTM or path
    let channel = "direct";
    if (utmSource) {
      channel = utmSource;
    } else if (pathname.startsWith("/articulo/")) {
      channel = "seo";
    } else if (pathname.startsWith("/herramientas/")) {
      channel = "tools";
    }

    fetch(`${API_URL}/api/attribution/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "pageview",
        visitor_id: getOrCreateVisitorId(),
        session_id: getSessionId(),
        channel,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        metadata: { path: pathname },
      }),
    }).catch(() => {
      // Silent fail — never break UX
    });
  }, [pathname, searchParams]);

  return null;
}
