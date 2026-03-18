"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import type { Site } from "@/lib/api";
import { api } from "@/lib/api";

const NAV = [
  { href: "/dashboard",              label: "Health",        icon: "◈" },
  { href: "/dashboard/leads",        label: "Leads",         icon: "◎" },
  { href: "/dashboard/content",      label: "Contenido",     icon: "▦" },
  { href: "/dashboard/strategy",     label: "Estrategia",    icon: "◇" },
  { href: "/dashboard/experiments",  label: "Experimentos",  icon: "⊛" },
  { href: "/dashboard/attribution",  label: "Atribución",    icon: "⌖" },
  { href: "/dashboard/approvals",    label: "Aprobaciones",  icon: "◉", badge: true },
  { href: "/dashboard/intelligence", label: "Intelligence",  icon: "⊕" },
  { href: "/dashboard/personas",     label: "Personas",      icon: "◑" },
  { href: "/dashboard/system",       label: "Sistema",       icon: "⚙" },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSiteId = searchParams.get("site_id") || "";
  const [sites, setSites] = useState<Site[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);

  const currentSite = sites.find((s) => s.id === currentSiteId);

  // Fetch sites once on mount; restore site_id from localStorage if missing from URL
  useEffect(() => {
    api.sites().then(setSites).catch(() => setSites([]));
    if (!searchParams.get("site_id")) {
      try {
        const stored = localStorage.getItem("cerebro_site_id");
        if (stored) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("site_id", stored);
          router.replace(`${pathname}?${params.toString()}`);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch pending approvals count
  const fetchPending = useCallback(async () => {
    try {
      const data = await api.approvals("pending", currentSiteId || undefined);
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setPendingCount(null);
    }
  }, [currentSiteId]);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 30_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Append / replace site_id in the current URL and persist to localStorage
  const selectSite = (siteId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (siteId) {
      params.set("site_id", siteId);
      try { localStorage.setItem("cerebro_site_id", siteId); } catch {}
    } else {
      params.delete("site_id");
      try { localStorage.removeItem("cerebro_site_id"); } catch {}
    }
    router.push(`${pathname}?${params.toString()}`);
    setBrandOpen(false);
  };

  const navContent = (
    <>
      {/* Brand header */}
      <div style={{ padding: "1.25rem 1rem 0.75rem", borderBottom: "1px solid var(--dash-border)" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "0.9375rem", color: "var(--dash-accent)", letterSpacing: "0.05em" }}>
          ⚡ CEREBRO
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--dash-text-dim)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "0.2rem" }}>
          Command Center
        </div>
      </div>

      {/* Brand selector */}
      <div style={{ padding: "0.625rem 0.75rem", borderBottom: "1px solid var(--dash-border)", position: "relative" }}>
        <button
          onClick={() => setBrandOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            padding: "0.4rem 0.6rem",
            background: "var(--dash-accent-dim)",
            border: "1px solid var(--dash-border-hi)",
            borderRadius: "6px",
            color: currentSite ? "var(--dash-accent)" : "var(--dash-text-dim)",
            fontSize: "0.75rem",
            fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentSite ? (currentSite.brand_name || currentSite.domain) : "Todos los sitios"}
          </span>
          <span style={{ opacity: 0.5, flexShrink: 0 }}>{brandOpen ? "▲" : "▼"}</span>
        </button>

        {brandOpen && (
          <div style={{
            position: "absolute",
            top: "calc(100% - 0.25rem)",
            left: "0.75rem",
            right: "0.75rem",
            background: "var(--dash-surface)",
            border: "1px solid var(--dash-border-hi)",
            borderRadius: "6px",
            overflow: "hidden",
            zIndex: 100,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            <button
              onClick={() => selectSite("")}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: !currentSiteId ? "var(--dash-accent-dim)" : "transparent",
                border: "none",
                color: !currentSiteId ? "var(--dash-accent)" : "var(--dash-text)",
                fontSize: "0.75rem",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Todos los sitios
            </button>
            {sites.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSite(s.id)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  background: currentSiteId === s.id ? "var(--dash-accent-dim)" : "transparent",
                  border: "none",
                  borderTop: "1px solid var(--dash-border)",
                  color: currentSiteId === s.id ? "var(--dash-accent)" : "var(--dash-text)",
                  fontSize: "0.75rem",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {s.brand_name || s.domain}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: "0.5rem" }}>
        {NAV.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const showBadge = item.badge && pendingCount != null && pendingCount > 0;
          return (
            <Link
              key={item.href}
              href={currentSiteId ? `${item.href}?site_id=${currentSiteId}` : item.href}
              className={`nav-item${isActive ? " active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <span style={{ fontSize: "0.875rem", width: "1.25rem", textAlign: "center", opacity: isActive ? 1 : 0.6, flexShrink: 0 }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {showBadge && (
                <span style={{
                  background: "var(--dash-danger)",
                  color: "#fff",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  padding: "0.1rem 0.35rem",
                  borderRadius: "8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  minWidth: "1.2rem",
                  textAlign: "center",
                }}>
                  {pendingCount! > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--dash-border)", fontSize: "0.625rem", color: "var(--dash-text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
        v7.0 · cerebro
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="dash-sidebar" style={{ display: "flex", flexDirection: "column" }}>
        {navContent}
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        style={{
          display: "none",
          position: "fixed",
          top: "0.75rem",
          left: "0.75rem",
          zIndex: 60,
          width: "2.25rem",
          height: "2.25rem",
          background: "var(--dash-surface)",
          border: "1px solid var(--dash-border)",
          borderRadius: "6px",
          color: "var(--dash-accent)",
          fontSize: "1rem",
          cursor: "pointer",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="mobile-menu-btn"
      >
        ☰
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 49,
            display: "none",
          }}
          className="mobile-overlay"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className="dash-sidebar mobile-drawer"
        style={{
          display: "none",
          flexDirection: "column",
          zIndex: 50,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s ease",
        }}
      >
        {navContent}
      </aside>
    </>
  );
}
