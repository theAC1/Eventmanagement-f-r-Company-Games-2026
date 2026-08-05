"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { StatusPill, type PillTone } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";

type User = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  rolle: string;
  istAktiv: boolean;
  mussPasswortAendern?: boolean;
  createdAt: string;
};

// Im UI neu vergebbare Rollen (ORGA/HELFER bleiben im Schema, werden nicht neu exponiert)
const ROLLEN = ["ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"] as const;

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  ORGA: "Orga",
  SCHIEDSRICHTER: "Schiedsrichter",
  HELFER: "Helfer",
};

const ROLE_TONES: Record<string, PillTone> = {
  OWNER: "action",
  ADMIN: "warn",
  ORGA: "action",
  SCHIEDSRICHTER: "done",
  HELFER: "neutral",
};

const GRID_COLS = "1.4fr 1fr 1.5fr 110px 210px";

const INPUT_CLASS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-label focus:border-action";

const SMALL_GHOST =
  "rounded-[7px] border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors duration-150 hover:border-action hover:text-ink";

const SMALL_DANGER_GHOST =
  "rounded-[7px] border border-[var(--hot-border)] px-2.5 py-1 text-[11px] font-medium text-hot-tint transition-colors duration-150 hover:bg-hot-dim";

function ActiveTogglePill({
  active,
  disabled,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-semibold tracking-[0.04em] transition-opacity duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:hover:opacity-100"
      style={
        active
          ? { color: "var(--done-tint)", background: "var(--done-dim)" }
          : { color: "var(--hot-tint)", background: "var(--hot-dim)" }
      }
    >
      {active ? "Aktiv" : "Deaktiviert"}
    </button>
  );
}

export function UsersClient({ isOwner }: { isOwner: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Aktivierungscode-Modal
  const [activationCode, setActivationCode] = useState<{ code: string; username: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [rolle, setRolle] = useState<string>("SCHIEDSRICHTER");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/api/users");
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setEmail("");
    setUsername("");
    setRolle("SCHIEDSRICHTER");
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(user: User) {
    setName(user.name);
    setEmail(user.email || "");
    setUsername(user.username || "");
    setRolle(ROLLEN.includes(user.rolle as (typeof ROLLEN)[number]) ? user.rolle : "SCHIEDSRICHTER");
    setEditingId(user.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (editingId) {
      const payload: Record<string, unknown> = { name, email, username, rolle };
      const res = await fetch(`/api/users/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern.");
        return;
      }
      resetForm();
      loadUsers();
      return;
    }

    // Neuer Account: Owner erhält einmalig einen Aktivierungscode
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, username, rolle }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Fehler beim Speichern.");
      return;
    }
    const created = await res.json();
    resetForm();
    loadUsers();
    if (created.aktivierungsCode) {
      setActivationCode({ code: created.aktivierungsCode, username: created.username });
      setCopied(false);
    }
  }

  async function resetActivation(user: User) {
    if (!confirm(`Neuen Aktivierungscode für ${user.name} erzeugen? Das bisherige Passwort wird ungültig.`)) return;
    const res = await fetch(`/api/users/${user.id}/reset-activation`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Fehler beim Zurücksetzen.");
      return;
    }
    const updated = await res.json();
    loadUsers();
    setActivationCode({ code: updated.aktivierungsCode, username: updated.username });
    setCopied(false);
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ istAktiv: !user.istAktiv }),
    });
    loadUsers();
  }

  async function handleDelete(user: User) {
    if (!confirm(`${user.name} wirklich löschen?`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Fehler beim Löschen.");
      return;
    }
    loadUsers();
  }

  async function copyCode() {
    if (!activationCode) return;
    try {
      await navigator.clipboard.writeText(activationCode.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Laden...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Benutzer">
        <span className="tnum text-xs text-ink-3">{users.length} Benutzer registriert</span>
        <TopBarSpacer />
        {isOwner && (
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Neuer Benutzer
          </Button>
        )}
      </TopBar>

      {!isOwner && (
        <p className="mx-4 mt-4 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-xs text-ink-3 sm:mx-[22px]">
          Nur der Owner kann Accounts anlegen oder Aktivierungscodes zurücksetzen.
        </p>
      )}

      {/* Formular */}
      {showForm && isOwner && (
        <div className="mx-4 mt-4 rounded-[10px] border border-line bg-surface p-5 sm:mx-[22px]">
          <h2 className="cg-label mb-4">
            {editingId ? "Benutzer bearbeiten" : "Neuer Benutzer"}
          </h2>
          {!editingId && (
            <p className="mb-4 text-xs text-ink-3">
              Beim Erstellen wird ein einmaliger Aktivierungscode erzeugt. Der neue Benutzer meldet sich
              damit an und setzt anschliessend sein eigenes Passwort.
            </p>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="cg-label block">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="cg-label block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="cg-label block">Benutzername *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                required
                className={`${INPUT_CLASS} tnum`}
                placeholder="z.B. max.muster"
              />
            </div>
            <div className="space-y-1.5">
              <label className="cg-label block">Rolle *</label>
              <select
                value={rolle}
                onChange={(e) => setRolle(e.target.value)}
                className={INPUT_CLASS}
              >
                {ROLLEN.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="primary">
                {editingId ? "Speichern" : "Erstellen"}
              </Button>
              <button
                type="button"
                onClick={resetForm}
                className="px-2 text-[13px] font-medium text-ink-3 transition-colors duration-150 hover:text-ink"
              >
                Abbrechen
              </button>
            </div>
            {error && (
              <p className="rounded-[9px] bg-hot-dim px-3 py-2 text-xs font-medium text-hot-tint sm:col-span-2">
                {error}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Tabellenkopf (ab lg) */}
      <div
        className="mt-4 hidden border-y border-line bg-sunken px-[22px] py-[11px] lg:grid"
        style={{ gridTemplateColumns: GRID_COLS, gap: "14px" }}
      >
        <span className="cg-label tracking-[0.1em]">Name</span>
        <span className="cg-label tracking-[0.1em]">Username</span>
        <span className="cg-label tracking-[0.1em]">Rolle</span>
        <span className="cg-label tracking-[0.1em]">Status</span>
        <span className="cg-label text-right tracking-[0.1em]">Aktionen</span>
      </div>

      {/* Zeilen / Karten */}
      <div className="max-lg:space-y-3 max-lg:p-4">
        {users.map((user) => {
          const roleTone = ROLE_TONES[user.rolle] ?? "neutral";
          const actions = isOwner && (
            <>
              {user.rolle !== "OWNER" && (
                <button onClick={() => resetActivation(user)} className={SMALL_GHOST}>
                  Code neu
                </button>
              )}
              <button onClick={() => startEdit(user)} className={SMALL_GHOST}>
                Bearbeiten
              </button>
              {user.rolle !== "OWNER" && (
                <button onClick={() => handleDelete(user)} className={SMALL_DANGER_GHOST}>
                  Löschen
                </button>
              )}
            </>
          );
          return (
            <div
              key={user.id}
              className="transition-colors duration-150 hover:bg-sunken/60 max-lg:rounded-[10px] max-lg:border max-lg:border-line max-lg:bg-surface lg:border-b lg:border-line-soft"
            >
              {/* Desktop-Zeile */}
              <div
                className="hidden min-h-[62px] items-center px-[22px] py-2 lg:grid"
                style={{ gridTemplateColumns: GRID_COLS, gap: "14px" }}
              >
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-sm font-medium text-ink">{user.name}</span>
                  {user.email && (
                    <span className="truncate text-[11px] text-ink-3">{user.email}</span>
                  )}
                </div>
                <span className="tnum truncate text-xs text-ink-3">
                  {user.username || "—"}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={roleTone}>
                    {ROLE_LABELS[user.rolle] || user.rolle}
                  </StatusPill>
                  {user.mussPasswortAendern && (
                    <StatusPill tone="warn">Nicht aktiviert</StatusPill>
                  )}
                </div>
                <div>
                  <ActiveTogglePill
                    active={user.istAktiv}
                    disabled={!isOwner}
                    onClick={() => toggleActive(user)}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">{actions}</div>
              </div>

              {/* Mobile-Karte */}
              <div className="flex flex-col gap-2.5 p-4 lg:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="truncate text-sm font-medium text-ink">{user.name}</span>
                    <span className="tnum truncate text-[11px] text-ink-3">
                      {user.username || "—"}
                      {user.email ? ` · ${user.email}` : ""}
                    </span>
                  </div>
                  <ActiveTogglePill
                    active={user.istAktiv}
                    disabled={!isOwner}
                    onClick={() => toggleActive(user)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={roleTone}>
                    {ROLE_LABELS[user.rolle] || user.rolle}
                  </StatusPill>
                  {user.mussPasswortAendern && (
                    <StatusPill tone="warn">Nicht aktiviert</StatusPill>
                  )}
                </div>
                {isOwner && (
                  <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Aktivierungscode-Modal */}
      {activationCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "var(--scrim)" }}
        >
          <div className="anim-pop w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-pop)]">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Aktivierungscode</h2>
            <p className="mt-1 text-sm text-ink-3">
              Für Benutzer <span className="tnum text-ink-2">{activationCode.username}</span>
            </p>
            <div className="mt-4 flex items-center gap-2">
              <code className="tnum flex-1 select-all rounded-[9px] border border-line bg-sunken px-3 py-2 text-lg tracking-[0.2em] text-warn">
                {activationCode.code}
              </code>
              <Button variant="primary" onClick={copyCode}>
                {copied ? "Kopiert" : "Kopieren"}
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-warn">
              <Warning size={14} weight="bold" />
              Dieser Code wird nur einmal angezeigt. Gib ihn dem Benutzer direkt weiter.
            </p>
            <div className="mt-5 text-right">
              <Button variant="ghost" onClick={() => setActivationCode(null)}>
                Schliessen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
