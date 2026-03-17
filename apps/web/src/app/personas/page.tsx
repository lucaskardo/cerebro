"use client";

import { useState, useEffect, useCallback } from "react";
import {
  api,
  updatePersona,
  updateIdentity,
  updateQueueItem,
  type Persona,
  type PersonaIdentity,
  type SocialQueueItem,
} from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  tiktok: "🎵",
  x: "✖",
  reddit: "🤖",
  linkedin: "💼",
  whatsapp: "💬",
  email: "✉️",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 bg-green-400/10 border-green-400/20",
  inactive: "text-slate-400 bg-slate-400/10 border-slate-600",
  suspended: "text-red-400 bg-red-400/10 border-red-400/20",
  pending_setup: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  draft: "text-slate-300 bg-slate-700 border-slate-600",
  scheduled: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  published: "text-green-400 bg-green-400/10 border-green-400/20",
  failed: "text-red-400 bg-red-400/10 border-red-400/20",
  rejected: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

const ALL_PLATFORMS = ["instagram", "tiktok", "x", "reddit", "linkedin", "whatsapp", "email"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "text-slate-400 bg-slate-700 border-slate-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function RevealModal({
  personaId,
  onClose,
}: {
  personaId: string;
  onClose: () => void;
}) {
  const [key, setKey] = useState("");
  const [identities, setIdentities] = useState<PersonaIdentity[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function reveal() {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const rows = await api.personaIdentitiesRevealed(personaId, key.trim());
      setIdentities(rows);
    } catch {
      setError("Master key inválida o error de servidor.");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">🔓 Revelar credenciales</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {!identities ? (
          <>
            <p className="text-slate-400 text-sm mb-4">
              Ingresa el Master Key para descifrar las contraseñas.
            </p>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reveal()}
              placeholder="Master key..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-green-500"
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={reveal}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Descifrando..." : "Revelar"}
            </button>
          </>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {identities.map((id) => (
              <div key={id.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{PLATFORM_ICONS[id.platform] ?? "🌐"}</span>
                  <span className="text-white text-sm font-medium capitalize">{id.platform}</span>
                  <StatusBadge status={id.status} />
                </div>
                {id.handle_or_email && (
                  <Row
                    label="Usuario"
                    value={id.handle_or_email}
                    id={`${id.id}-user`}
                    copied={copied}
                    onCopy={copy}
                  />
                )}
                {id.password_plaintext && (
                  <Row
                    label="Contraseña"
                    value={id.password_plaintext}
                    id={`${id.id}-pass`}
                    copied={copied}
                    onCopy={copy}
                    secret
                  />
                )}
                {id.recovery_email && (
                  <Row
                    label="Recovery email"
                    value={id.recovery_email}
                    id={`${id.id}-rec`}
                    copied={copied}
                    onCopy={copy}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  id,
  copied,
  onCopy,
  secret = false,
}: {
  label: string;
  value: string;
  id: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  secret?: boolean;
}) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-slate-400 text-xs w-24 shrink-0">{label}</span>
      <span className="text-slate-200 text-xs font-mono flex-1 truncate">
        {show ? value : "••••••••••••"}
      </span>
      <div className="flex gap-1 shrink-0">
        {secret && (
          <button onClick={() => setShow(!show)} className="text-slate-500 hover:text-slate-300 text-xs px-1">
            {show ? "🙈" : "👁"}
          </button>
        )}
        <button
          onClick={() => onCopy(value, id)}
          className="text-slate-500 hover:text-green-400 text-xs px-1 transition-colors"
        >
          {copied === id ? "✓" : "📋"}
        </button>
      </div>
    </div>
  );
}

function IdentityRow({
  identity,
  onUpdate,
}: {
  identity: PersonaIdentity;
  onUpdate: (id: string, data: Partial<PersonaIdentity & { password?: string }>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState(identity.handle_or_email ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const data: Record<string, string> = {};
    if (handle !== identity.handle_or_email) data.handle_or_email = handle;
    if (password) data.password = password;
    if (handle && identity.status === "pending_setup") data.status = "active";
    if (Object.keys(data).length > 0) await onUpdate(identity.id, data);
    setPassword("");
    setEditing(false);
    setSaving(false);
  }

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="py-3 px-4 w-8">
        <span className="text-lg">{PLATFORM_ICONS[identity.platform] ?? "🌐"}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-slate-300 text-sm capitalize">{identity.platform}</span>
      </td>
      <td className="py-3 px-4">
        {editing ? (
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-48 focus:outline-none focus:border-green-500"
            placeholder="@usuario o email"
          />
        ) : (
          <span className="text-slate-400 text-sm font-mono">
            {identity.handle_or_email ?? <em className="text-slate-600">sin configurar</em>}
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        {editing ? (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white w-36 focus:outline-none focus:border-green-500"
            placeholder="Nueva contraseña"
          />
        ) : (
          <span className="text-slate-600 text-sm font-mono">
            {identity.password_encrypted ? "••••••••" : "—"}
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={identity.status} />
      </td>
      <td className="py-3 px-4 text-right">
        {editing ? (
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              {saving ? "…" : "Guardar"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 transition-colors"
          >
            Editar
          </button>
        )}
      </td>
    </tr>
  );
}

function QueueTab({ personaId }: { personaId: string }) {
  const [items, setItems] = useState<SocialQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("draft");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.socialQueue({ persona_id: personaId, status: filter, limit: 30 });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [personaId, filter]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    await updateQueueItem(id, { status: "scheduled" });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "scheduled" } : i)));
  }

  async function reject(id: string) {
    await updateQueueItem(id, { status: "rejected" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {["draft", "scheduled", "published", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === s
                ? "bg-green-600 border-green-600 text-white"
                : "border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando cola...</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm">No hay items en estado "{filter}".</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-base">{PLATFORM_ICONS[item.platform] ?? "🌐"}</span>
                    <span className="text-slate-300 text-sm capitalize font-medium">{item.platform}</span>
                    <span className="text-slate-500 text-xs">/</span>
                    <span className="text-slate-400 text-xs">{item.content_type}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.content_assets?.title && (
                    <p className="text-slate-500 text-xs mb-2 truncate">
                      📄 {item.content_assets.title}
                    </p>
                  )}
                  <p className="text-slate-300 text-sm line-clamp-3 font-mono whitespace-pre-wrap leading-relaxed">
                    {item.content_text.slice(0, 300)}
                    {item.content_text.length > 300 && "…"}
                  </p>
                </div>
                {item.status === "draft" && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => approve(item.id)}
                      className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => reject(item.id)}
                      className="border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [identities, setIdentities] = useState<Record<string, PersonaIdentity[]>>({});
  const [loading, setLoading] = useState(true);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"identities" | "queue">("identities");
  const [revealPersonaId, setRevealPersonaId] = useState<string | null>(null);

  async function loadPersonas() {
    try {
      const data = await api.personas();
      setPersonas(data);
      if (data.length > 0 && !activePersona) {
        setActivePersona(data[0].id);
        loadIdentities(data[0].id);
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }

  async function loadIdentities(pid: string) {
    if (identities[pid]) return;
    try {
      const data = await api.personaIdentities(pid);
      setIdentities((prev) => ({ ...prev, [pid]: data }));
    } catch {
      setIdentities((prev) => ({ ...prev, [pid]: [] }));
    }
  }

  useEffect(() => { loadPersonas(); }, []); // eslint-disable-line

  function selectPersona(pid: string) {
    setActivePersona(pid);
    setActiveTab("identities");
    loadIdentities(pid);
  }

  async function handleToggleStatus(persona: Persona) {
    const next = persona.status === "active" ? "inactive" : "active";
    await updatePersona(persona.id, { status: next });
    setPersonas((prev) =>
      prev.map((p) => (p.id === persona.id ? { ...p, status: next as Persona["status"] } : p))
    );
  }

  async function handleIdentityUpdate(
    personaId: string,
    id: string,
    data: Partial<PersonaIdentity & { password?: string }>
  ) {
    const updated = await updateIdentity(id, data);
    setIdentities((prev) => ({
      ...prev,
      [personaId]: (prev[personaId] ?? []).map((i) => (i.id === id ? updated : i)),
    }));
  }

  const currentPersona = personas.find((p) => p.id === activePersona);
  const currentIdentities = activePersona ? (identities[activePersona] ?? []) : [];
  const configuredCount = currentIdentities.filter((i) => i.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Personas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestión de identidades digitales y cola de contenido social
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando personas...</p>
      ) : personas.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No hay personas configuradas.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar — persona list */}
          <div className="w-56 shrink-0 space-y-2">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPersona(p.id)}
                className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                  activePersona === p.id
                    ? "bg-slate-700 border-slate-500 shadow-lg"
                    : "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                }`}
              >
                <div className="font-medium text-white text-sm">{p.name}</div>
                <div className="text-slate-500 text-xs mt-0.5 truncate">{p.city}</div>
                <div className="mt-2">
                  <StatusBadge status={p.status} />
                </div>
              </button>
            ))}
          </div>

          {/* Main panel */}
          {currentPersona && (
            <div className="flex-1 min-w-0">
              {/* Persona header card */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{currentPersona.name}</h2>
                    {currentPersona.city && (
                      <p className="text-slate-400 text-sm mt-0.5">📍 {currentPersona.city}</p>
                    )}
                    {currentPersona.backstory && (
                      <p className="text-slate-400 text-sm mt-2 max-w-lg line-clamp-2">
                        {currentPersona.backstory}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <StatusBadge status={currentPersona.status} />
                      <span className="text-slate-500 text-xs">
                        {configuredCount}/{ALL_PLATFORMS.length} cuentas configuradas
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleStatus(currentPersona)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        currentPersona.status === "active"
                          ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                          : "border-green-500/50 text-green-400 hover:bg-green-500/10"
                      }`}
                    >
                      {currentPersona.status === "active" ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      onClick={() => setRevealPersonaId(currentPersona.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                    >
                      🔓 Revelar
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Setup progress</span>
                    <span>{configuredCount}/{ALL_PLATFORMS.length}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(configuredCount / ALL_PLATFORMS.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4">
                <button
                  onClick={() => setActiveTab("identities")}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === "identities"
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Cuentas
                </button>
                <button
                  onClick={() => setActiveTab("queue")}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === "queue"
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Cola social
                </button>
              </div>

              {/* Tab content */}
              {activeTab === "identities" && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50">
                        <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium w-8"></th>
                        <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium">Plataforma</th>
                        <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium">Usuario / Email</th>
                        <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium">Contraseña</th>
                        <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium">Estado</th>
                        <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentIdentities.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                            Cargando identidades...
                          </td>
                        </tr>
                      ) : (
                        currentIdentities.map((identity) => (
                          <IdentityRow
                            key={identity.id}
                            identity={identity}
                            onUpdate={(id, data) =>
                              handleIdentityUpdate(currentPersona.id, id, data)
                            }
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "queue" && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <QueueTab personaId={currentPersona.id} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reveal modal */}
      {revealPersonaId && (
        <RevealModal
          personaId={revealPersonaId}
          onClose={() => setRevealPersonaId(null)}
        />
      )}
    </div>
  );
}
