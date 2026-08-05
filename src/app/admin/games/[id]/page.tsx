"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { AuditInfo } from "@/components/audit-info";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/pills";

type GameVariante = {
  id: string;
  name: string;
  beschreibung: string | null;
  istAktiv: boolean;
};

type Game = {
  id: string;
  name: string;
  slug: string;
  typ: "RETURNEE" | "NEU";
  status: "ENTWURF" | "BEREIT" | "AKTIV" | "ABGESCHLOSSEN";
  modus: "SOLO" | "DUELL";
  teamsProSlot: number;
  kurzbeschreibung: string | null;
  einfuehrungMin: number;
  playtimeMin: number;
  reserveMin: number;
  regeln: string | null;
  wertungstyp: string | null;
  wertungslogik: Record<string, unknown> | null;
  flaecheLaengeM: number | null;
  flaecheBreiteM: number | null;
  helferAnzahl: number;
  schiedsrichterAnzahl: number;
  stromNoetig: boolean;
  varianten: GameVariante[];
  _count: { materialItems: number; ergebnisse: number };
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

const STATUS_OPTIONS = [
  { value: "ENTWURF", label: "Entwurf" },
  { value: "BEREIT", label: "Bereit" },
  { value: "AKTIV", label: "Aktiv" },
  { value: "ABGESCHLOSSEN", label: "Abgeschlossen" },
];

const INPUT_CLASS =
  "w-full h-[38px] rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink outline-none transition-colors duration-150 focus:border-action";
const TEXTAREA_CLASS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-action";

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadGame = useCallback(() => {
    fetch(`/api/games/${gameId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Game nicht gefunden");
        return res.json();
      })
      .then((data) => {
        setGame(data);
        setDirty(false);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [gameId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const updateField = <K extends keyof Game>(field: K, value: Game[K]) => {
    if (!game) return;
    setGame({ ...game, [field]: value });
    setDirty(true);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (!game) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(game),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      const updated = await res.json();
      setGame(updated);
      setDirty(false);
      setSuccessMsg("Gespeichert");
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`"${game?.name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`))
      return;
    try {
      const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade Game...
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-sm text-hot-tint">{error}</p>
        <Link
          href="/admin"
          className="text-sm text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  if (!game) return null;

  const totalMin = game.einfuehrungMin + game.playtimeMin + game.reserveMin;

  return (
    <div className="flex flex-col">
      <TopBar
        title={
          <span className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-ink-3 transition-colors duration-150 hover:text-ink"
            >
              Games
            </Link>
            <CaretRight size={13} weight="bold" className="text-faint" />
            <span>{game.name}</span>
          </span>
        }
      >
        <span className="hidden sm:inline-flex">
          <AuditInfo
            createdBy={game.createdBy}
            updatedBy={game.updatedBy}
            createdAt={game.createdAt}
            updatedAt={game.updatedAt}
          />
        </span>
        <TopBarSpacer />
        {successMsg && <span className="text-sm text-done-tint">{successMsg}</span>}
        {error && <span className="text-sm text-hot-tint">{error}</span>}
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? "Speichert..." : "Speichern"}
        </Button>
      </TopBar>

      <div className="px-4 py-6 sm:px-[22px]">
        <div className="max-w-4xl space-y-5">
          {/* Grunddaten */}
          <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
            <h2 className="cg-label">Grunddaten</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  type="text"
                  value={game.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Slug">
                <input
                  type="text"
                  value={game.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  className={`${INPUT_CLASS} tnum text-ink-3`}
                />
              </Field>
            </div>

            <Field label="Kurzbeschreibung">
              <textarea
                value={game.kurzbeschreibung ?? ""}
                onChange={(e) => updateField("kurzbeschreibung", e.target.value || null)}
                rows={2}
                className={`${TEXTAREA_CLASS} resize-none`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="Typ">
                <select
                  value={game.typ}
                  onChange={(e) => updateField("typ", e.target.value as Game["typ"])}
                  className={INPUT_CLASS}
                >
                  <option value="RETURNEE">Returnee</option>
                  <option value="NEU">Neu</option>
                </select>
              </Field>
              <Field label="Modus">
                <select
                  value={game.modus}
                  onChange={(e) => {
                    const m = e.target.value as Game["modus"];
                    updateField("modus", m);
                    if (m === "SOLO") updateField("teamsProSlot", 1);
                    if (m === "DUELL") updateField("teamsProSlot", 2);
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="SOLO">Solo</option>
                  <option value="DUELL">Duell</option>
                </select>
              </Field>
              <Field label="Teams/Slot">
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={game.teamsProSlot}
                  onChange={(e) => updateField("teamsProSlot", parseInt(e.target.value) || 1)}
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
              <Field label="Status">
                <select
                  value={game.status}
                  onChange={(e) => updateField("status", e.target.value as Game["status"])}
                  className={INPUT_CLASS}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Zeitstruktur */}
          <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="cg-label">Zeitstruktur</h2>
              <span className="tnum text-xs text-ink-3">
                Total: {totalMin} min pro Slot
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Einführung (min)">
                <input
                  type="number"
                  min={0}
                  value={game.einfuehrungMin}
                  onChange={(e) => updateField("einfuehrungMin", parseInt(e.target.value) || 0)}
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
              <Field label="Spielzeit (min)">
                <input
                  type="number"
                  min={1}
                  value={game.playtimeMin}
                  onChange={(e) => updateField("playtimeMin", parseInt(e.target.value) || 1)}
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
              <Field label="Reserve (min)">
                <input
                  type="number"
                  min={0}
                  value={game.reserveMin}
                  onChange={(e) => updateField("reserveMin", parseInt(e.target.value) || 0)}
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
            </div>
          </section>

          {/* Setup / Infrastruktur */}
          <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
            <h2 className="cg-label">Setup &amp; Infrastruktur</h2>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Field label="Länge (m)">
                <input
                  type="number"
                  step="0.5"
                  value={game.flaecheLaengeM ?? ""}
                  onChange={(e) =>
                    updateField("flaecheLaengeM", e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
              <Field label="Breite (m)">
                <input
                  type="number"
                  step="0.5"
                  value={game.flaecheBreiteM ?? ""}
                  onChange={(e) =>
                    updateField("flaecheBreiteM", e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
              <Field label="Helfer">
                <input
                  type="number"
                  min={0}
                  value={game.helferAnzahl}
                  onChange={(e) => updateField("helferAnzahl", parseInt(e.target.value) || 0)}
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
              <Field label="Schiedsrichter">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={game.schiedsrichterAnzahl}
                  onChange={(e) => updateField("schiedsrichterAnzahl", parseInt(e.target.value) || 1)}
                  className={`${INPUT_CLASS} tnum`}
                />
              </Field>
              <Field label="Strom">
                <button
                  type="button"
                  onClick={() => updateField("stromNoetig", !game.stromNoetig)}
                  className={`h-[38px] w-full rounded-[9px] border text-sm font-medium transition-colors duration-150 ${
                    game.stromNoetig
                      ? "border-[var(--warn-border)] bg-warn-dim text-warn"
                      : "border-line-strong bg-sunken text-ink-3"
                  }`}
                >
                  {game.stromNoetig ? "Ja" : "Nein"}
                </button>
              </Field>
            </div>
          </section>

          {/* Regeln */}
          <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
            <h2 className="cg-label">Regeln</h2>
            <textarea
              value={game.regeln ?? ""}
              onChange={(e) => updateField("regeln", e.target.value || null)}
              rows={10}
              placeholder="Markdown-Regeln hier eingeben..."
              className={`${TEXTAREA_CLASS} font-mono resize-y`}
            />
          </section>

          {/* Wertungslogik (JSON) */}
          <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="cg-label">Wertungslogik</h2>
              <span className="tnum text-xs text-ink-3">
                Typ: {game.wertungstyp ?? "–"}
              </span>
            </div>
            <Field label="Wertungstyp">
              <input
                type="text"
                value={game.wertungstyp ?? ""}
                onChange={(e) => updateField("wertungstyp", e.target.value || null)}
                placeholder="z.B. punkte, zeit, laenge, hoehe..."
                className={`${INPUT_CLASS} tnum`}
              />
            </Field>
            <Field label="Wertungslogik (JSON)">
              <WertungslogikEditor
                value={game.wertungslogik}
                onChange={(v) => updateField("wertungslogik", v)}
              />
            </Field>
          </section>

          {/* Varianten (read-only preview for now) */}
          {game.varianten.length > 0 && (
            <section className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
              <h2 className="cg-label">
                Varianten ({game.varianten.length})
              </h2>
              <div className="space-y-2">
                {game.varianten.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-[9px] border border-line bg-sunken px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-ink">{v.name}</span>
                      {v.beschreibung && (
                        <span className="ml-3 text-ink-3">{v.beschreibung}</span>
                      )}
                    </div>
                    {v.istAktiv && <StatusPill tone="done">Aktiv</StatusPill>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Danger Zone */}
          <section className="space-y-4 rounded-[10px] border border-[var(--hot-border)] bg-surface p-5">
            <h2 className="cg-label" style={{ color: "var(--hot-tint)" }}>
              Danger Zone
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink-2">Game endgültig löschen</p>
                <p className="text-xs text-ink-3">
                  Löscht das Game und alle zugehörigen Varianten. Kann nicht
                  rückgängig gemacht werden.
                </p>
              </div>
              <Button variant="danger-ghost" onClick={handleDelete}>
                Game löschen
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ───

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="cg-label">{label}</label>
      {children}
    </div>
  );
}

function WertungslogikEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
}) {
  const [text, setText] = useState(value ? JSON.stringify(value, null, 2) : "");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleChange = (newText: string) => {
    setText(newText);
    if (!newText.trim()) {
      setJsonError(null);
      onChange(null);
      return;
    }
    try {
      const parsed = JSON.parse(newText);
      setJsonError(null);
      onChange(parsed);
    } catch {
      setJsonError("Ungültiges JSON");
    }
  };

  return (
    <div className="space-y-1">
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={8}
        className={`w-full resize-y rounded-[9px] border bg-sunken px-3 py-2 font-mono text-sm text-ink outline-none transition-colors duration-150 ${
          jsonError
            ? "border-[var(--hot-border)]"
            : "border-line-strong focus:border-action"
        }`}
      />
      {jsonError && <p className="text-xs text-hot-tint">{jsonError}</p>}
    </div>
  );
}
