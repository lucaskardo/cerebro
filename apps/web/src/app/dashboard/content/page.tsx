"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentAsset, Site, ContentRecommendation } from "@/lib/api";
import { api, reviewContent, getContentRecommendations, generateContent, deleteContent, submitFeedback, getArticleDetail, type FeedbackPayload } from "@/lib/api";
import ExportCSV from "@/components/dashboard/ExportCSV";

const STATUS_TABS = ["all", "draft", "review", "approved", "generating", "error"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const BADGE_CLASS: Record<string, string> = {
  approved: "badge badge-green",
  review: "badge badge-yellow",
  draft: "badge badge-gray",
  generating: "badge badge-blue",
  error: "badge badge-red",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function scoreColor(score: number | null) {
  if (score == null) return "var(--dash-text-dim)";
  if (score >= 80) return "var(--dash-accent)";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = scoreColor(value);
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{label}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
      </div>
      <div style={{ height: "5px", background: "var(--dash-border)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${v}%`, background: color, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function ScoreDetail({ item, onClose }: { item: ContentAsset; onClose: () => void }) {
  const total = item.score_humanity != null
    ? Math.round((item.score_humanity * 0.25) + ((item.score_specificity ?? 0) * 0.25) + ((item.score_structure ?? 0) * 0.2) + ((item.score_seo ?? 0) * 0.2) + ((item.score_readability ?? 0) * 0.1))
    : null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--dash-card)", border: "1px solid var(--dash-border)", borderRadius: "12px",
        padding: "1.5rem", width: "100%", maxWidth: "420px", boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--dash-text)", marginBottom: "2px" }}>
              {truncate(item.title, 50)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>Score de calidad IA</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dash-text-dim)", fontSize: "1.25rem", lineHeight: 1 }}>×</button>
        </div>

        {total != null ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "2.5rem", fontWeight: 800, color: scoreColor(total), fontFamily: "'JetBrains Mono', monospace" }}>{total}</span>
              <span style={{ fontSize: "1rem", color: "var(--dash-text-dim)" }}>/100</span>
            </div>
            <ScoreBar label="Humanidad" value={item.score_humanity} />
            <ScoreBar label="Especificidad" value={item.score_specificity} />
            <ScoreBar label="Estructura" value={item.score_structure} />
            <ScoreBar label="SEO" value={item.score_seo} />
            <ScoreBar label="Legibilidad" value={item.score_readability} />
            {item.score_feedback && (
              <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--dash-bg)", borderRadius: "8px", border: "1px solid var(--dash-border)" }}>
                <div style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Feedback</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.6 }}>{item.score_feedback}</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem", padding: "1rem 0" }}>
            Score no disponible — artículos nuevos se evalúan automáticamente durante generación.
          </div>
        )}
      </div>
    </div>
  );
}

interface Toast { id: number; msg: string; ok: boolean; }

function ContentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteId = searchParams.get("site_id") || "";
  const statusParam = searchParams.get("status");
  const activeTab: StatusTab = (STATUS_TABS as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as StatusTab)
    : "all";

  const [items, setItems] = useState<ContentAsset[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});
  const [scoreDetail, setScoreDetail] = useState<ContentAsset | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [generateKeyword, setGenerateKeyword] = useState("");
  const [generateTopic, setGenerateTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackSeverity, setFeedbackSeverity] = useState<"low" | "medium" | "high">("medium");
  const [makeRule, setMakeRule] = useState(false);
  const [ruleScope, setRuleScope] = useState<"all" | "keyword">("keyword");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.content(undefined, siteId || undefined),
      api.sites(),
    ]).then(([c, s]) => {
      if (c.status === "fulfilled") setItems(c.value);
      else setError(String((c as PromiseRejectedResult).reason));
      if (s.status === "fulfilled") setSites(s.value);
      setLoading(false);
    });
  }, [siteId]);

  function addToast(msg: string, ok: boolean) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  async function handleReview(item: ContentAsset, action: "approve" | "reject") {
    setActioning((prev) => ({ ...prev, [item.id]: true }));
    try {
      await reviewContent(item.id, action);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: action === "approve" ? "approved" : "draft" }
            : i
        )
      );
      addToast(
        action === "approve"
          ? `"${truncate(item.title, 40)}" aprobado`
          : `"${truncate(item.title, 40)}" rechazado`,
        action === "approve"
      );
    } catch {
      addToast(`Error al ${action === "approve" ? "aprobar" : "rechazar"}`, false);
    } finally {
      setActioning((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function openGenerate() {
    setShowGenerate(true);
    setGenerateKeyword("");
    setGenerateTopic("");
    setLoadingRecs(true);
    try {
      const recs = await getContentRecommendations(siteId);
      setRecommendations(recs);
    } catch {
      setRecommendations([]);
    }
    setLoadingRecs(false);
  }

  async function handleGenerate() {
    if (!generateKeyword.trim()) return;
    setGenerating(true);
    try {
      const siteData = sites.find(s => s.id === siteId);
      const missionId = siteData?.mission_id || "";
      if (!missionId) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://web-production-c6ed5.up.railway.app"}/api/sites`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("cerebro_token") || ""}` }
        });
        const allSites = await res.json();
        const site = (Array.isArray(allSites) ? allSites : []).find((s: any) => s.id === siteId);
        const mid = site?.mission_id || "";
        if (!mid) throw new Error("No mission_id found for this site");
        await generateContent({ keyword: generateKeyword.trim(), topic: generateTopic.trim() || undefined, site_id: siteId, mission_id: mid });
      } else {
        await generateContent({ keyword: generateKeyword.trim(), topic: generateTopic.trim() || undefined, site_id: siteId, mission_id: missionId });
      }
      addToast(`Generating article: "${generateKeyword.trim()}"`, true);
      setShowGenerate(false);
      setGenerateKeyword("");
      setGenerateTopic("");
      setTimeout(() => {
        api.content(undefined, siteId || undefined).then(setItems).catch(() => {});
      }, 2000);
    } catch (e: any) {
      addToast(`Error: ${e.message}`, false);
    }
    setGenerating(false);
  }

  async function openPreview(item: ContentAsset) {
    setPreviewId(item.id);
    setPreviewLoading(true);
    setFeedbackText(""); setFeedbackReason(""); setMakeRule(false); setRuleScope("keyword");
    try {
      const detail = await getArticleDetail(item.id);
      setPreviewArticle(detail);
    } catch { setPreviewArticle(item); }
    setPreviewLoading(false);
  }

  function closePreview() {
    setPreviewId(null); setPreviewArticle(null); setFeedbackText(""); setFeedbackReason("");
  }

  async function handleFeedback(decision: FeedbackPayload["decision"]) {
    if (!previewArticle) return;
    if (decision !== "approve" && decision !== "approve_minor" && !feedbackReason) {
      addToast("Selecciona una razón", false); return;
    }
    setSubmittingFeedback(true);
    try {
      await submitFeedback(previewArticle.id, {
        decision, primary_reason: feedbackReason || undefined,
        severity: feedbackSeverity, free_text: feedbackText || undefined,
        make_rule: makeRule, rule_scope: ruleScope,
      });
      const msgs: Record<string, string> = {
        approve: "Artículo aprobado", approve_minor: "Aprobado con nota",
        regenerate: "Regenerando con feedback...", reject: "Rechazado",
      };
      addToast(msgs[decision] || "Done", true);
      closePreview();
      setTimeout(() => api.content(undefined, siteId || undefined).then(setItems).catch(() => {}), 2000);
    } catch (e: any) { addToast(e.message, false); }
    setSubmittingFeedback(false);
  }

  const siteMap = Object.fromEntries(sites.map((s) => [s.id, s.brand_name || s.domain]));

  const counts: Record<string, number> = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  const filtered = activeTab === "all" ? items : items.filter((i) => i.status === activeTab);
  const totalArticles = items.length;
  const approvedCount = counts["approved"] ?? 0;
  const pendingReview = counts["review"] ?? 0;
  const qualityItems = items.filter((i) => i.quality_score != null);
  const avgQuality =
    qualityItems.length > 0
      ? Math.round(qualityItems.reduce((s, i) => s + (i.quality_score ?? 0), 0) / qualityItems.length)
      : null;

  function tabHref(tab: string) {
    const p = new URLSearchParams();
    if (tab !== "all") p.set("status", tab);
    if (siteId) p.set("site_id", siteId);
    return `/dashboard/content${p.toString() ? `?${p}` : ""}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <style>{`
        .title-preview-btn:hover { text-decoration: underline; color: var(--dash-accent) !important; }
        .title-preview-btn:hover::after { content: " 👁"; font-size: 0.75rem; }
        .article-preview-content h1 { font-size: 1.4rem; font-weight: 700; margin: 1.5rem 0 0.75rem; }
        .article-preview-content h2 { font-size: 1.2rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .article-preview-content h3 { font-size: 1.05rem; font-weight: 600; margin: 1rem 0 0.5rem; }
        .article-preview-content p { margin: 0.5rem 0; }
        .article-preview-content ul, .article-preview-content ol { padding-left: 1.5rem; margin: 0.5rem 0; }
        .article-preview-content li { margin: 0.25rem 0; }
        .article-preview-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .article-preview-content th, .article-preview-content td { padding: 6px 10px; border: 1px solid var(--dash-border); }
        .article-preview-content blockquote { border-left: 3px solid var(--dash-accent); padding-left: 1rem; margin: 1rem 0; font-style: italic; }
        .article-preview-content hr { border: none; border-top: 1px solid var(--dash-border); margin: 1.5rem 0; }
        .article-preview-content a { color: var(--dash-accent); text-decoration: underline; }
      `}</style>
      {scoreDetail && <ScoreDetail item={scoreDetail} onClose={() => setScoreDetail(null)} />}
      {previewId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closePreview}>
          <div style={{ background: "var(--dash-card, #1a1a2e)", borderRadius: "12px", width: "min(960px, 95vw)", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--dash-border)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--dash-border)", display: "flex", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{previewArticle?.title || "Cargando..."}</h2>
                {previewArticle?.keyword && <div style={{ fontSize: "0.8rem", color: "var(--dash-text-dim)", marginTop: "4px" }}>Keyword: {previewArticle.keyword}</div>}
                {previewArticle?.quality_score != null && (
                  <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                    <span style={{ color: "var(--dash-accent)" }}>AI {previewArticle.score_humanity || 0}/100</span>{" · "}Q {previewArticle.quality_score}/100
                  </div>
                )}
                {previewArticle?.meta_description && <div style={{ fontSize: "0.8rem", color: "var(--dash-text-dim)", marginTop: "4px", fontStyle: "italic" }}>{previewArticle.meta_description}</div>}
              </div>
              <button onClick={closePreview} style={{ background: "none", border: "none", color: "var(--dash-text)", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px" }}>
              {previewLoading ? <p style={{ color: "var(--dash-text-dim)" }}>Cargando...</p>
              : previewArticle?.body_html ? (
                <div className="article-preview-content" dangerouslySetInnerHTML={{ __html: previewArticle.body_html }} style={{ fontSize: "0.95rem", lineHeight: 1.8 }} />
              ) : previewArticle?.body_md ? (
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", color: "var(--dash-text-dim)" }}>{previewArticle.body_md}</pre>
              ) : <p style={{ color: "var(--dash-text-dim)" }}>Sin contenido.</p>}

              {(previewArticle?.faq_section?.length ?? 0) > 0 && (
                <div style={{ marginTop: "2rem", borderTop: "1px solid var(--dash-border)", paddingTop: "1.5rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Preguntas Frecuentes</h3>
                  {previewArticle.faq_section?.map((faq: any, i: number) => (
                    <details key={i} style={{ marginBottom: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--dash-border)" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>{faq.question}</summary>
                      <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", lineHeight: 1.7, color: "var(--dash-text-dim)" }}>{faq.answer}</p>
                    </details>
                  ))}
                </div>
              )}

              {(previewArticle?.metadata?.feedback_history?.length ?? 0) > 0 && (
                <div style={{ marginTop: "1.5rem", padding: "10px 14px", background: "rgba(255,200,0,0.05)", borderRadius: "8px", border: "1px solid rgba(255,200,0,0.15)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f59e0b", marginBottom: "4px" }}>Feedback anterior</div>
                  {previewArticle.metadata.feedback_history.slice(-3).map((fb: any, i: number) => (
                    <div key={i} style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginBottom: "2px" }}>• [{fb.reason}] {fb.text}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Review panel — only for reviewable articles */}
            {previewArticle?.status === "review" && previewArticle?.body_html && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid var(--dash-border)" }}>

                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginBottom: "6px" }}>¿Qué mejorar? (requerido para regenerar/rechazar)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {[
                      {v:"accuracy",l:"Dato falso"},{v:"market_specificity",l:"No aplica a Panamá"},
                      {v:"tone",l:"Tono / voz"},{v:"style",l:"Muy genérico / AI"},
                      {v:"structure",l:"Estructura"},{v:"seo",l:"SEO débil"},
                      {v:"product_error",l:"Producto mal"},{v:"competitor_error",l:"Competidor mal"},
                      {v:"missing_info",l:"Falta info"},{v:"cta",l:"CTA débil"},
                    ].map(r => (
                      <button key={r.v} onClick={() => setFeedbackReason(r.v)} style={{
                        padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer",
                        border: feedbackReason === r.v ? "1px solid var(--dash-accent)" : "1px solid var(--dash-border)",
                        background: feedbackReason === r.v ? "rgba(0,255,136,0.08)" : "transparent",
                        color: feedbackReason === r.v ? "var(--dash-accent)" : "var(--dash-text-dim)",
                      }}>{r.l}</button>
                    ))}
                  </div>
                </div>

                <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Describe qué está mal y cómo mejorarlo..."
                  rows={2} style={{
                    width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--dash-border)",
                    background: "var(--dash-bg)", color: "var(--dash-text)", fontSize: "0.8rem",
                    boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", marginBottom: "8px",
                  }} />

                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "0.8rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", color: "var(--dash-text-dim)" }}>
                    <input type="checkbox" checked={makeRule} onChange={e => setMakeRule(e.target.checked)} />
                    Regla permanente
                  </label>
                  {makeRule && (
                    <select value={ruleScope} onChange={e => setRuleScope(e.target.value as any)}
                      style={{ padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--dash-border)", background: "var(--dash-bg)", color: "var(--dash-text)", fontSize: "0.75rem" }}>
                      <option value="keyword">Solo este keyword</option>
                      <option value="all">Todos los artículos</option>
                    </select>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button onClick={() => handleFeedback("reject")} disabled={submittingFeedback}
                    style={{ padding: "8px 14px", borderRadius: "8px", cursor: "pointer", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "0.8rem" }}>
                    Rechazar
                  </button>
                  <button onClick={() => handleFeedback("regenerate")} disabled={submittingFeedback || !feedbackReason}
                    style={{ padding: "8px 14px", borderRadius: "8px", cursor: "pointer", border: "1px solid #f59e0b", background: "transparent", color: "#f59e0b", fontSize: "0.8rem", fontWeight: 500, opacity: feedbackReason ? 1 : 0.4 }}>
                    Regenerar con Feedback
                  </button>
                  <button onClick={() => handleFeedback("approve")} disabled={submittingFeedback}
                    style={{ padding: "8px 14px", borderRadius: "8px", cursor: "pointer", border: "none", background: "var(--dash-accent)", color: "#000", fontWeight: 600, fontSize: "0.8rem" }}>
                    Aprobar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 200, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {toasts.map((t) => (
            <div key={t.id} style={{
              padding: "0.625rem 1rem",
              borderRadius: "8px",
              fontSize: "0.8125rem",
              fontWeight: 500,
              background: t.ok ? "var(--dash-accent)" : "var(--dash-danger)",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              animation: "fadeIn 0.15s ease",
            }}>
              {t.ok ? "✓ " : "✗ "}{t.msg}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 className="page-title">Contenido</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
            {loading ? "…" : `${totalArticles} artículo${totalArticles !== 1 ? "s" : ""} en pipeline`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <ExportCSV data={filtered as unknown as Record<string, unknown>[]} filename="content.csv" label="Export CSV" />
          <button
            onClick={openGenerate}
            disabled={!siteId}
            style={{
              background: "var(--dash-accent)", color: "#000", border: "none",
              padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
              fontWeight: 600, fontSize: "0.9rem",
              opacity: siteId ? 1 : 0.4,
            }}
          >
            + Generar Artículo
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#ff4d4d11", border: "1px solid #ff4d4d33", borderRadius: "8px", padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--dash-danger)" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const count = tab === "all" ? totalArticles : (counts[tab] ?? 0);
          const isActive = tab === activeTab;
          return (
            <Link
              key={tab}
              href={tabHref(tab)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                padding: "0.3rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem",
                fontWeight: 600, textDecoration: "none",
                border: isActive ? "1px solid var(--dash-accent)" : "1px solid var(--dash-border)",
                background: isActive ? "var(--dash-accent-dim)" : "transparent",
                color: isActive ? "var(--dash-accent)" : "var(--dash-text-dim)",
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{tab === "all" ? "Todos" : tab}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6875rem", opacity: 0.75 }}>
                {loading ? "…" : count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : totalArticles}</div><div className="stat-label">Total artículos</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : approvedCount}</div><div className="stat-label">Aprobados</div></div>
        <div className="dash-card"><div className="stat-value">{loading ? "…" : avgQuality != null ? avgQuality : "—"}</div><div className="stat-label">Calidad promedio</div></div>
        <div className="dash-card"><div className="stat-value" style={{ color: pendingReview > 0 ? "var(--dash-warn)" : undefined }}>{loading ? "…" : pendingReview}</div><div className="stat-label">En revisión</div></div>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: "2.5rem" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>
            {activeTab === "all"
              ? <>No hay artículos todavía. <Link href="/dashboard/system" style={{ color: "var(--dash-accent)" }}>Genera uno →</Link></>
              : `No hay artículos con estado "${activeTab}".`}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Brand</th>
                  <th>Keyword</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Calidad</th>
                  <th style={{ textAlign: "right" }}>AI Score</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const title = truncate((item.title ?? "").replace("[GENERATING] ", ""), 55);
                  const qualColor =
                    item.quality_score == null
                      ? "var(--dash-text-dim)"
                      : item.quality_score >= 80
                      ? "var(--dash-accent)"
                      : item.quality_score >= 60
                      ? "#f59e0b"
                      : "#ff4d4d";
                  const brandName = item.site_id ? (siteMap[item.site_id] ?? item.site_id.slice(0, 8) + "…") : "—";
                  const isLoading = actioning[item.id];

                  // Compute AI total from 5 dimensions
                  const aiTotal = item.score_humanity != null
                    ? Math.round((item.score_humanity * 0.25) + ((item.score_specificity ?? 0) * 0.25) + ((item.score_structure ?? 0) * 0.2) + ((item.score_seo ?? 0) * 0.2) + ((item.score_readability ?? 0) * 0.1))
                    : null;

                  return (
                    <tr key={item.id}>
                      <td style={{ maxWidth: "280px", minWidth: 0 }}>
                        <button
                          className="title-preview-btn"
                          onClick={() => openPreview(item)}
                          style={{
                            display: "block", overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", color: "var(--dash-text)", fontWeight: 500,
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                            textAlign: "left", width: "100%", fontSize: "inherit", textDecoration: "none",
                          }}
                          title={`Click para previsualizar: ${item.title}`}
                        >
                          {title}
                        </button>
                        {item.status === "error" && item.error_message && (
                          <div style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "2px", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.error_message}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ fontSize: "0.6875rem" }}>{brandName}</span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{item.keyword ?? "—"}</span>
                      </td>
                      <td>
                        <span className={BADGE_CLASS[item.status] ?? "badge badge-gray"}>{item.status}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="mono" style={{ fontSize: "0.8125rem", fontWeight: 600, color: qualColor }}>
                          {item.quality_score != null ? `${item.quality_score}/100` : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {aiTotal != null ? (
                          <button
                            onClick={() => setScoreDetail(item)}
                            style={{
                              background: "none", border: "none", cursor: "pointer", padding: 0,
                              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem", fontWeight: 700,
                              color: scoreColor(aiTotal),
                            }}
                            title="Ver desglose de score"
                          >
                            {aiTotal} ↗
                          </button>
                        ) : (
                          <span style={{ color: "var(--dash-text-dim)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{formatDate(item.created_at)}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                          {item.status === "review" && (
                            <button onClick={() => openPreview(item)} style={{
                              padding: "4px 12px", borderRadius: "6px", cursor: "pointer",
                              border: "1px solid var(--dash-accent)", background: "transparent",
                              color: "var(--dash-accent)", fontSize: "0.75rem", fontWeight: 500,
                            }}>Revisar</button>
                          )}
                          {item.status === "approved" && (
                            <Link
                              href={`/articulo/${item.slug}`}
                              target="_blank"
                              style={{ padding: "0.25rem 0.625rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, border: "1px solid var(--dash-border)", color: "var(--dash-text-dim)", textDecoration: "none" }}
                            >
                              Ver →
                            </Link>
                          )}
                          {item.status === "error" && (
                            <>
                              <button
                                onClick={async () => {
                                  if (!confirm("¿Regenerar este artículo?")) return;
                                  setActioning(a => ({...a, [item.id]: true}));
                                  try {
                                    const siteData = sites.find(s => s.id === siteId);
                                    const mid = siteData?.mission_id || "";
                                    await generateContent({ keyword: item.keyword, site_id: siteId, mission_id: mid });
                                    addToast(`Regenerando: "${item.keyword}"`, true);
                                    try { await deleteContent(item.id); } catch {}
                                    setTimeout(() => api.content(undefined, siteId || undefined).then(setItems).catch(() => {}), 2000);
                                  } catch (e: any) {
                                    addToast(`Error: ${e.message}`, false);
                                  }
                                  setActioning(a => ({...a, [item.id]: false}));
                                }}
                                disabled={isLoading}
                                style={{
                                  padding: "4px 10px", borderRadius: "6px", cursor: "pointer",
                                  border: "1px solid var(--dash-accent)", background: "transparent",
                                  color: "var(--dash-accent)", fontSize: "0.75rem", fontWeight: 500,
                                  opacity: isLoading ? 0.6 : 1,
                                }}
                              >
                                Regenerar
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm("¿Borrar este artículo?")) return;
                                  setActioning(a => ({...a, [item.id]: true}));
                                  try {
                                    await deleteContent(item.id);
                                    addToast("Artículo eliminado", true);
                                    setItems(items.filter(i => i.id !== item.id));
                                  } catch (e: any) {
                                    addToast(`Error: ${e.message}`, false);
                                  }
                                  setActioning(a => ({...a, [item.id]: false}));
                                }}
                                disabled={isLoading}
                                style={{
                                  padding: "4px 10px", borderRadius: "6px", cursor: "pointer",
                                  border: "1px solid #ef4444", background: "transparent",
                                  color: "#ef4444", fontSize: "0.75rem", fontWeight: 500,
                                  opacity: isLoading ? 0.6 : 1,
                                }}
                              >
                                Borrar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGenerate && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowGenerate(false)}>
          <div style={{
            background: "var(--dash-card)", borderRadius: "12px", padding: "24px",
            width: "min(600px, 90vw)", maxHeight: "80vh", overflowY: "auto",
            border: "1px solid var(--dash-border)",
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem" }}>Generar Artículo Nuevo</h2>
            <p style={{ color: "var(--dash-text-dim)", fontSize: "0.85rem", margin: "0 0 16px" }}>
              CEREBRO recomienda temas basados en inteligencia del mercado. Elige uno o escribe tu propio keyword.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "4px" }}>
                Keyword SEO (corto, para posicionar en Google)
              </label>
              <input
                type="text"
                value={generateKeyword}
                onChange={e => setGenerateKeyword(e.target.value)}
                placeholder="ej: colchones para embarazadas panama"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: "8px",
                  border: "1px solid var(--dash-border)", background: "var(--dash-bg)",
                  color: "var(--dash-text)", fontSize: "0.9rem", boxSizing: "border-box",
                }}
                onKeyDown={e => e.key === "Enter" && handleGenerate()}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "4px" }}>
                Tema / Descripción (qué debe cubrir el artículo)
              </label>
              <textarea
                value={generateTopic}
                onChange={e => setGenerateTopic(e.target.value)}
                placeholder="ej: Guía completa para embarazadas sobre qué colchón elegir, firmeza ideal, materiales seguros, posiciones para dormir"
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: "8px",
                  border: "1px solid var(--dash-border)", background: "var(--dash-bg)",
                  color: "var(--dash-text)", fontSize: "0.9rem", boxSizing: "border-box",
                  resize: "vertical", fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "8px" }}>
                Recomendaciones de CEREBRO
              </label>
              {loadingRecs ? (
                <p style={{ color: "var(--dash-text-dim)", fontSize: "0.85rem" }}>Analizando inteligencia...</p>
              ) : recommendations.length === 0 ? (
                <p style={{ color: "var(--dash-text-dim)", fontSize: "0.85rem" }}>No hay recomendaciones disponibles. Escribe tu propio keyword arriba.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "250px", overflowY: "auto" }}>
                  {recommendations.map((rec, i) => (
                    <div
                      key={i}
                      onClick={() => { setGenerateKeyword(rec.keyword); setGenerateTopic(rec.topic || ""); }}
                      style={{
                        padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
                        border: generateKeyword === rec.keyword ? "1px solid var(--dash-accent)" : "1px solid var(--dash-border)",
                        background: generateKeyword === rec.keyword ? "rgba(0,255,136,0.05)" : "transparent",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "2px" }}>
                        {rec.keyword}
                      </div>
                      {rec.topic && (
                        <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", marginBottom: "2px", fontStyle: "italic" }}>
                          {rec.topic}
                        </div>
                      )}
                      <div style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                        {rec.reason} · <span style={{
                          color: rec.source === "insight" ? "var(--dash-accent)" : rec.source === "entity" ? "#60a5fa" : "#a78bfa",
                        }}>{rec.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowGenerate(false)}
                style={{
                  padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
                  border: "1px solid var(--dash-border)", background: "transparent",
                  color: "var(--dash-text)", fontSize: "0.85rem",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={!generateKeyword.trim() || generating}
                style={{
                  padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
                  border: "none", background: "var(--dash-accent)", color: "#000",
                  fontWeight: 600, fontSize: "0.85rem",
                  opacity: !generateKeyword.trim() || generating ? 0.4 : 1,
                }}
              >
                {generating ? "Generando..." : "Generar Artículo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardContentPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <ContentPageContent />
    </Suspense>
  );
}
