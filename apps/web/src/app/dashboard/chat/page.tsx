"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: { tool: string; input: Record<string, unknown> }[];
  timestamp?: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

function fmtTool(name: string): string {
  const map: Record<string, string> = {
    get_leads:              "Consultando leads…",
    get_content_performance:"Revisando contenido…",
    generate_content:       "Generando artículo…",
    approve_content:        "Aprobando artículo…",
    query_data:             "Consultando datos…",
    create_experiment:      "Creando experimento…",
    explain_metric:         "Analizando métrica…",
    update_intelligence:    "Actualizando perfil…",
    run_cycle:              "Ejecutando ciclo…",
  };
  return map[name] || `Ejecutando ${name}…`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000)  return "ahora";
  if (diff < 3600_000) return `hace ${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `hace ${Math.floor(diff / 3600_000)}h`;
  return d.toLocaleDateString("es-PA", { month: "short", day: "numeric" });
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState("");
  const [streaming, setStreaming]         = useState(false);
  const [actionLabel, setActionLabel]     = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs]   = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load conversation list ──────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!siteId) { setLoadingConvs(false); return; }
    try {
      const res = await fetch(`${API_URL}/api/chat/conversations?site_id=${siteId}`, {
        headers: { "X-API-Key": API_KEY },
      });
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvs(false);
    }
  }, [siteId]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Load a specific conversation ────────────────────────────────────────
  const loadConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const res = await fetch(`${API_URL}/api/chat/${id}`, {
        headers: { "X-API-Key": API_KEY },
      });
      const data = await res.json();
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages.map((m: Record<string, unknown>) => ({
          role:    m.role as "user" | "assistant",
          content: m.content as string,
          actions: m.actions_taken as Message["actions"],
          timestamp: m.timestamp as string,
        })));
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, actionLabel]);

  // ── Send message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !siteId) return;

    setInput("");
    setStreaming(true);
    setActionLabel(null);

    // Optimistic user bubble
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // Placeholder assistant bubble
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${API_URL}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "X-API-Key":     API_KEY,
        },
        body: JSON.stringify({ site_id: siteId, conversation_id: activeId, message: text }),
      });

      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accText   = "";
      const actions: Message["actions"] = [];
      let newConvId = activeId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(trimmed.slice(5).trim());

            if (evt.type === "action") {
              setActionLabel(fmtTool(evt.tool));
              actions.push({ tool: evt.tool, input: evt.input });
            }

            if (evt.type === "text") {
              accText += evt.delta;
              setActionLabel(null);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: accText,
                  actions: actions.length ? [...actions] : undefined,
                };
                return updated;
              });
            }

            if (evt.type === "done") {
              newConvId = evt.conversation_id;
              setActiveId(evt.conversation_id);
            }

            if (evt.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: `⚠ Error: ${evt.message}`,
                };
                return updated;
              });
            }
          } catch { /* incomplete JSON chunk */ }
        }
      }

      // Refresh conversation list (new conv may have been created)
      if (!activeId || newConvId !== activeId) {
        await fetchConversations();
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `⚠ Error de conexión: ${String(err)}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      setActionLabel(null);
      textareaRef.current?.focus();
    }
  }, [input, streaming, siteId, activeId, fetchConversations]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Suggestion chips ────────────────────────────────────────────────────
  const suggestions = [
    "¿Cuántos leads tuve esta semana?",
    "¿Qué artículo genera más leads?",
    "Genera un artículo sobre colchones orthopédicos",
    "¿Cómo está el score promedio de mis leads?",
  ];

  const isEmpty = messages.length === 0 && !loadingMsgs;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── Conversation sidebar ──────────────────────────────────────────── */}
      <aside style={{
        width: "220px",
        flexShrink: 0,
        borderRight: "1px solid var(--dash-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "0.875rem 0.875rem 0.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--dash-border)",
        }}>
          <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--dash-text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
            Conversaciones
          </span>
          <button
            onClick={() => { setActiveId(null); setMessages([]); }}
            title="Nueva conversación"
            style={{
              background: "none",
              border: "1px solid var(--dash-border)",
              color: "var(--dash-accent)",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.75rem",
              padding: "0.15rem 0.4rem",
              lineHeight: 1.2,
            }}
          >
            +
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingConvs ? (
            <div style={{ padding: "1rem 0.875rem", color: "var(--dash-text-dim)", fontSize: "0.75rem" }}>Cargando…</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: "1rem 0.875rem", color: "var(--dash-text-dim)", fontSize: "0.75rem" }}>Sin conversaciones aún</div>
          ) : conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => loadConversation(c.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.55rem 0.875rem",
                background: activeId === c.id ? "var(--dash-accent-dim)" : "none",
                border: "none",
                borderBottom: "1px solid var(--dash-border)",
                cursor: "pointer",
                color: activeId === c.id ? "var(--dash-accent)" : "var(--dash-text)",
              }}
            >
              <div style={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.2rem" }}>
                {c.title || "Conversación"}
              </div>
              <div style={{ fontSize: "0.625rem", color: "var(--dash-text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                {fmtDate(c.updated_at)}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Chat area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Empty state */}
          {isEmpty && (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: "480px" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚡</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "1.125rem", color: "var(--dash-text)", marginBottom: "0.5rem" }}>
                CEREBRO Chat
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginBottom: "1.5rem" }}>
                {siteId ? "Tu socio de negocio con acceso a todos tus datos." : "Selecciona un sitio en el sidebar para comenzar."}
              </div>
              {siteId && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: "var(--dash-accent-dim)",
                        border: "1px solid var(--dash-border-hi)",
                        borderRadius: "20px",
                        color: "var(--dash-accent)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading past messages */}
          {loadingMsgs && (
            <div style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem", textAlign: "center", marginTop: "2rem" }}>
              Cargando conversación…
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "0.25rem" }}>

              {/* Action chips */}
              {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.25rem" }}>
                  {msg.actions.map((a, j) => (
                    <span key={j} style={{
                      fontSize: "0.625rem",
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "20px",
                      background: "var(--dash-accent-dim)",
                      border: "1px solid var(--dash-border-hi)",
                      color: "var(--dash-accent)",
                    }}>
                      ⚙ {a.tool}
                    </span>
                  ))}
                </div>
              )}

              {/* Bubble */}
              <div style={{
                maxWidth: "72%",
                padding: "0.65rem 0.875rem",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: msg.role === "user" ? "var(--dash-accent)" : "var(--dash-surface)",
                border: msg.role === "assistant" ? "1px solid var(--dash-border)" : "none",
                color: msg.role === "user" ? "#fff" : "var(--dash-text)",
                fontSize: "0.8125rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}>
                {msg.content || (
                  <span style={{ opacity: 0.4, fontStyle: "italic" }}>…</span>
                )}
              </div>
            </div>
          ))}

          {/* Live action label */}
          {actionLabel && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--dash-accent)",
              fontSize: "0.75rem",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
              {actionLabel}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{
          padding: "0.875rem 1.25rem 1rem",
          borderTop: "1px solid var(--dash-border)",
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-end",
          background: "var(--dash-bg)",
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={siteId ? "Pregunta algo o pide que haga algo…" : "Selecciona un sitio primero"}
            disabled={!siteId || streaming}
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              padding: "0.6rem 0.875rem",
              background: "var(--dash-surface)",
              border: "1px solid var(--dash-border-hi)",
              borderRadius: "10px",
              color: "var(--dash-text)",
              fontSize: "0.875rem",
              fontFamily: "inherit",
              lineHeight: 1.5,
              outline: "none",
              minHeight: "40px",
              maxHeight: "160px",
              overflowY: "auto",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!siteId || !input.trim() || streaming}
            style={{
              padding: "0.6rem 1rem",
              background: !siteId || !input.trim() || streaming ? "var(--dash-surface)" : "var(--dash-accent)",
              border: "1px solid var(--dash-border-hi)",
              borderRadius: "10px",
              color: !siteId || !input.trim() || streaming ? "var(--dash-text-dim)" : "#fff",
              fontSize: "0.875rem",
              cursor: !siteId || !input.trim() || streaming ? "not-allowed" : "pointer",
              flexShrink: 0,
              height: "40px",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {streaming ? "…" : "↑"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
