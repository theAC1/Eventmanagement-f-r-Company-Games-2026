"use client";

import { useCallback, useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { StatusPill, type PillTone } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";
import { apiFetch, apiSend } from "@/lib/api-client";
import { meldung } from "@/lib/api-fehler";
import { darfBenutzerVerwalten, vergebbareRollen } from "@/lib/benutzer-rechte";

type User = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  rolle: string;
  istAktiv: boolean;
  mussPasswortAendern?: boolean;
  isstMittag: boolean;
  createdAt: string;
  posten?: { id: string; name: string }[];
};


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

/**
 * Verpflegung: Posten-Crew isst immer mit (sie pausiert mit ihrem Posten),
 * alle anderen brauchen eine ausdrückliche Angabe — sonst fehlt die Person in
 * der Zahl, mit der die Küche plant.
 */
function MittagPill({
  user,
  disabled,
  onToggle,
}: {
  user: User;
  disabled: boolean;
  onToggle: () => void;
}) {
  const amPosten = (user.posten?.length ?? 0) > 0;
  if (amPosten) {
    return (
      <StatusPill tone="neutral">
        Mittag: Posten-Welle
      </StatusPill>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title="Isst diese Person am Turniertag mit?"
      className="inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-semibold tracking-[0.04em] transition-opacity duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:hover:opacity-100"
      style={
        user.isstMittag
          ? { color: "var(--done-tint)", background: "var(--done-dim)" }
          : { color: "var(--ink-3)", background: "var(--sunken)" }
      }
    >
      {user.isstMittag ? "Isst mit" : "Kein Mittag"}
    </button>
  );
}

type UsersClientProps = {
  /** Rolle des angemeldeten Accounts — bestimmt, wen er verwalten darf. */
  eigeneRolle: string;
  eigeneId: string;
};

type AktivierungsAntwort = User & { aktivierungsCode?: string };

export function UsersClient({ eigeneRolle, eigeneId }: UsersClientProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Aktivierungscode-Modal
  const [activationCode, setActivationCode] = useState<{ code: string; username: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Rollen, die dieser Account vergeben darf (Admins z. B. keine Admins)
  const rollen = vergebbareRollen(eigeneRolle);
  const darfAnlegen = rollen.length > 0;
  const standardRolle = rollen.includes("SCHIEDSRICHTER")
    ? "SCHIEDSRICHTER"
    : (rollen[rollen.length - 1] ?? "");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [rolle, setRolle] = useState<string>(standardRolle);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await apiFetch<User[]>("/api/users"));
      setError("");
    } catch (err) {
      setError(meldung(err, "Benutzer konnten nicht geladen werden."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  /** Darf dieser Account den gezeigten Benutzer bearbeiten oder löschen? */
  const darfVerwalten = (user: User) => darfBenutzerVerwalten(eigeneRolle, user.rolle);

  function resetForm() {
    setName("");
    setEmail("");
    setUsername("");
    setRolle(standardRolle);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(user: User) {
    setName(user.name);
    setEmail(user.email || "");
    setUsername(user.username || "");
    setRolle(rollen.includes(user.rolle) ? user.rolle : standardRolle);
    setEditingId(user.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      if (editingId) {
        await apiSend(`/api/users/${editingId}`, "PUT", { name, email, username, rolle });
        resetForm();
        await loadUsers();
        return;
      }

      // Neuer Account: der Ersteller erhält einmalig einen Aktivierungscode
      const created = await apiSend<AktivierungsAntwort>("/api/users", "POST", {
        name,
        email,
        username,
        rolle,
      });
      resetForm();
      await loadUsers();
      if (created.aktivierungsCode) {
        setActivationCode({
          code: created.aktivierungsCode,
          username: created.username ?? username,
        });
        setCopied(false);
      }
    } catch (err) {
      setError(meldung(err, "Fehler beim Speichern."));
    }
  }

  async function resetActivation(user: User) {
    if (!confirm(`Neuen Aktivierungscode für ${user.name} erzeugen? Das bisherige Passwort wird ungültig.`)) return;
    try {
      const updated = await apiSend<AktivierungsAntwort>(
        `/api/users/${user.id}/reset-activation`,
        "POST",
      );
      await loadUsers();
      setActivationCode({
        code: updated.aktivierungsCode ?? "",
        username: updated.username ?? user.username ?? "",
      });
      setCopied(false);
    } catch (err) {
      setError(meldung(err, "Fehler beim Zurücksetzen."));
    }
  }

  async function toggleActive(user: User) {
    try {
      await apiSend(`/api/users/${user.id}`, "PUT", { istAktiv: !user.istAktiv });
      await loadUsers();
    } catch (err) {
      setError(meldung(err, "Status konnte nicht geändert werden."));
    }
  }

  async function toggleMittag(user: User) {
    try {
      await apiSend(`/api/users/${user.id}`, "PUT", { isstMittag: !user.isstMittag });
      await loadUsers();
    } catch (err) {
      setError(meldung(err, "Mittag-Angabe konnte nicht geändert werden."));
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`${user.name} wirklich löschen?`)) return;
    try {
      await apiSend(`/api/users/${user.id}`, "DELETE");
      await loadUsers();
    } catch (err) {
      setError(meldung(err, "Fehler beim Löschen."));
    }
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
        {darfAnlegen && (
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

      {!darfAnlegen && (
        <p className="mx-4 mt-4 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-xs text-ink-3 sm:mx-[22px]">
          Deine Rolle kann keine Accounts anlegen — dafür braucht es mindestens Admin.
        </p>
      )}

      {/* Formular */}
      {showForm && darfAnlegen && (
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
              <label className="cg-label block">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="leer lassen, wenn unbekannt"
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
                {rollen.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
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
          // Verwalten darf man nur Accounts unterhalb der eigenen Stufe —
          // dieselbe Regel, die auch die API durchsetzt.
          const verwaltbar = darfVerwalten(user);
          const actions = verwaltbar && (
            <>
              <button onClick={() => resetActivation(user)} className={SMALL_GHOST}>
                Code neu
              </button>
              <button onClick={() => startEdit(user)} className={SMALL_GHOST}>
                Bearbeiten
              </button>
              {user.id !== eigeneId && (
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
                  <MittagPill
                    user={user}
                    disabled={!verwaltbar}
                    onToggle={() => toggleMittag(user)}
                  />
                </div>
                <div>
                  <ActiveTogglePill
                    active={user.istAktiv}
                    disabled={!verwaltbar}
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
                    disabled={!verwaltbar}
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
                  <MittagPill
                    user={user}
                    disabled={!verwaltbar}
                    onToggle={() => toggleMittag(user)}
                  />
                </div>
                {verwaltbar && (
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
