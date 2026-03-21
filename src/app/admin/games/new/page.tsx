"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewGamePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    typ: "NEU" as "RETURNEE" | "NEU",
    modus: "SOLO" as "SOLO" | "DUELL",
    teamsProSlot: 1,
    kurzbeschreibung: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist erforderlich");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          kurzbeschreibung: form.kurzbeschreibung || null,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen");
      const game = await res.json();
      router.push(`/admin/games/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin" className="hover:text-white transition">
          Games
        </Link>
        <span>/</span>
        <span className="text-white">Neues Game</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Neues Game erstellen</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border border-zinc-800 rounded-lg p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Mega Jenga"
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Kurzbeschreibung
            </label>
            <textarea
              value={form.kurzbeschreibung}
              onChange={(e) =>
                setForm({ ...form, kurzbeschreibung: e.target.value })
              }
              rows={2}
              placeholder="Worum geht es bei diesem Game?"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Typ
              </label>
              <select
                value={form.typ}
                onChange={(e) =>
                  setForm({ ...form, typ: e.target.value as typeof form.typ })
                }
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              >
                <option value="NEU">Neu</option>
                <option value="RETURNEE">Returnee</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Modus
              </label>
              <select
                value={form.modus}
                onChange={(e) => {
                  const m = e.target.value as typeof form.modus;
                  setForm({
                    ...form,
                    modus: m,
                    teamsProSlot: m === "DUELL" ? 2 : 1,
                  });
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              >
                <option value="SOLO">Solo</option>
                <option value="DUELL">Duell</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Teams/Slot
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={form.teamsProSlot}
                onChange={(e) =>
                  setForm({ ...form, teamsProSlot: parseInt(e.target.value) || 1 })
                }
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {saving ? "Erstellt..." : "Game erstellen"}
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
          >
            Abbrechen
          </Link>
        </div>
      </form>

      <p className="text-xs text-zinc-600">
        Nach dem Erstellen kannst du Regeln, Wertungslogik, Zeitstruktur und mehr
        auf der Detail-Seite konfigurieren.
      </p>
    </div>
  );
}
