"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type GameOption = { id: string; name: string };

const KATEGORIEN = [
  { value: "SPONSOR", label: "Sponsor" },
  { value: "MIETE", label: "Miete" },
  { value: "KAUF", label: "Kauf" },
  { value: "EIGENBAU", label: "Eigenbau" },
  { value: "VERBRAUCH", label: "Verbrauch" },
  { value: "INFRASTRUKTUR", label: "Infrastruktur" },
];

export default function NewMaterialPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    gameId: "",
    kategorie: "KAUF",
    menge: "",
    beschreibung: "",
    sponsor: "",
    kostenGeschaetzt: "",
  });

  useEffect(() => {
    fetch("/api/games")
      .then((res) => res.json())
      .then((data) => setGames(data.map((g: GameOption) => ({ id: g.id, name: g.name }))));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name ist erforderlich"); return; }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gameId: form.gameId || null,
          kostenGeschaetzt: form.kostenGeschaetzt ? parseFloat(form.kostenGeschaetzt) : null,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen");
      const item = await res.json();
      router.push(`/admin/materials/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin/materials" className="hover:text-white transition">Material</Link>
        <span>/</span>
        <span className="text-white">Neu</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Neues Material</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border border-zinc-800 rounded-lg p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Erusbacher Harassen"
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Game</label>
              <select
                value={form.gameId}
                onChange={(e) => setForm({ ...form, gameId: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              >
                <option value="">Allgemein (kein Game)</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Kategorie</label>
              <select
                value={form.kategorie}
                onChange={(e) => setForm({ ...form, kategorie: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              >
                {KATEGORIEN.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Menge</label>
              <input
                type="text"
                value={form.menge}
                onChange={(e) => setForm({ ...form, menge: e.target.value })}
                placeholder="z.B. 100 + 50 Reserve"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Sponsor</label>
              <input
                type="text"
                value={form.sponsor}
                onChange={(e) => setForm({ ...form, sponsor: e.target.value })}
                placeholder="z.B. Erusbacher Bier"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Kosten (CHF)</label>
              <input
                type="number"
                step="0.01"
                value={form.kostenGeschaetzt}
                onChange={(e) => setForm({ ...form, kostenGeschaetzt: e.target.value })}
                placeholder="Geschätzt"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Beschreibung</label>
            <textarea
              value={form.beschreibung}
              onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
              rows={2}
              placeholder="Zusätzliche Details..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {saving ? "Erstellt..." : "Material erstellen"}
          </button>
          <Link href="/admin/materials" className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
