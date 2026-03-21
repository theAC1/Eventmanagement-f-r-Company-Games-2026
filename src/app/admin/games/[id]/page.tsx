"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  stromNoetig: boolean;
  varianten: GameVariante[];
  _count: { materialItems: number; ergebnisse: number };
};

const STATUS_OPTIONS = [
  { value: "ENTWURF", label: "Entwurf" },
  { value: "BEREIT", label: "Bereit" },
  { value: "AKTIV", label: "Aktiv" },
  { value: "ABGESCHLOSSEN", label: "Abgeschlossen" },
];

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
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Game...
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400">{error}</p>
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  if (!game) return null;

  const totalMin = game.einfuehrungMin + game.playtimeMin + game.reserveMin;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/admin" className="hover:text-white transition">
            Games
          </Link>
          <span>/</span>
          <span className="text-white">{game.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {successMsg && (
            <span className="text-sm text-emerald-400">{successMsg}</span>
          )}
          {error && <span className="text-sm text-red-400">{error}</span>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              dirty
                ? "bg-white text-black hover:bg-zinc-200"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {saving ? "Speichert..." : "Speichern"}
          </button>
        </div>
      </div>

      {/* Grunddaten */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Grunddaten</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input
              type="text"
              value={game.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Slug">
            <input
              type="text"
              value={game.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400 focus:outline-none focus:border-zinc-500"
            />
          </Field>
        </div>

        <Field label="Kurzbeschreibung">
          <textarea
            value={game.kurzbeschreibung ?? ""}
            onChange={(e) => updateField("kurzbeschreibung", e.target.value || null)}
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
          />
        </Field>

        <div className="grid grid-cols-4 gap-4">
          <Field label="Typ">
            <select
              value={game.typ}
              onChange={(e) => updateField("typ", e.target.value as Game["typ"])}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Status">
            <select
              value={game.status}
              onChange={(e) => updateField("status", e.target.value as Game["status"])}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
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
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zeitstruktur</h2>
          <span className="text-sm text-zinc-500">
            Total: {totalMin} min pro Slot
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Einführung (min)">
            <input
              type="number"
              min={0}
              value={game.einfuehrungMin}
              onChange={(e) => updateField("einfuehrungMin", parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Spielzeit (min)">
            <input
              type="number"
              min={1}
              value={game.playtimeMin}
              onChange={(e) => updateField("playtimeMin", parseInt(e.target.value) || 1)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Reserve (min)">
            <input
              type="number"
              min={0}
              value={game.reserveMin}
              onChange={(e) => updateField("reserveMin", parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
        </div>
      </section>

      {/* Setup / Infrastruktur */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Setup &amp; Infrastruktur</h2>

        <div className="grid grid-cols-4 gap-4">
          <Field label="Länge (m)">
            <input
              type="number"
              step="0.5"
              value={game.flaecheLaengeM ?? ""}
              onChange={(e) =>
                updateField("flaecheLaengeM", e.target.value ? parseFloat(e.target.value) : null)
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Helfer">
            <input
              type="number"
              min={0}
              value={game.helferAnzahl}
              onChange={(e) => updateField("helferAnzahl", parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Strom">
            <button
              onClick={() => updateField("stromNoetig", !game.stromNoetig)}
              className={`w-full py-2 rounded-lg text-sm font-medium border transition ${
                game.stromNoetig
                  ? "bg-amber-900/40 border-amber-700 text-amber-300"
                  : "bg-zinc-900 border-zinc-700 text-zinc-500"
              }`}
            >
              {game.stromNoetig ? "Ja" : "Nein"}
            </button>
          </Field>
        </div>
      </section>

      {/* Regeln */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Regeln</h2>
        <textarea
          value={game.regeln ?? ""}
          onChange={(e) => updateField("regeln", e.target.value || null)}
          rows={10}
          placeholder="Markdown-Regeln hier eingeben..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-500 resize-y"
        />
      </section>

      {/* Wertungslogik (JSON) */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Wertungslogik</h2>
          <span className="text-xs text-zinc-500">
            Typ: {game.wertungstyp ?? "–"}
          </span>
        </div>
        <Field label="Wertungstyp">
          <input
            type="text"
            value={game.wertungstyp ?? ""}
            onChange={(e) => updateField("wertungstyp", e.target.value || null)}
            placeholder="z.B. punkte, zeit, laenge, hoehe..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
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
        <section className="border border-zinc-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            Varianten ({game.varianten.length})
          </h2>
          <div className="space-y-2">
            {game.varianten.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between border rounded-lg px-4 py-3 text-sm ${
                  v.istAktiv
                    ? "border-emerald-800 bg-emerald-950/30"
                    : "border-zinc-800"
                }`}
              >
                <div>
                  <span className="font-medium">{v.name}</span>
                  {v.beschreibung && (
                    <span className="ml-3 text-zinc-500">{v.beschreibung}</span>
                  )}
                </div>
                {v.istAktiv && (
                  <span className="text-xs text-emerald-400">Aktiv</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="border border-red-900/50 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Game endgültig löschen</p>
            <p className="text-xs text-zinc-500">
              Löscht das Game und alle zugehörigen Varianten. Kann nicht rückgängig
              gemacht werden.
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-red-400 border border-red-800 rounded-lg hover:bg-red-950 transition"
          >
            Game löschen
          </button>
        </div>
      </section>
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
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}
      </label>
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
        className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-y ${
          jsonError ? "border-red-700" : "border-zinc-700 focus:border-zinc-500"
        }`}
      />
      {jsonError && <p className="text-xs text-red-400">{jsonError}</p>}
    </div>
  );
}
