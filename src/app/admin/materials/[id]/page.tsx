"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type MaterialItem = {
  id: string;
  name: string;
  kategorie: string;
  menge: string | null;
  beschreibung: string | null;
  status: string;
  sponsor: string | null;
  kostenGeschaetzt: string | null;
  kostenEffektiv: string | null;
  gameId: string | null;
  game: { id: string; name: string; slug: string } | null;
  verantwortlich: { id: string; name: string } | null;
  kommentare: { id: string; text: string; createdAt: string; autor: { name: string } }[];
};

type GameOption = { id: string; name: string };

const KATEGORIEN = [
  { value: "SPONSOR", label: "Sponsor" },
  { value: "MIETE", label: "Miete" },
  { value: "KAUF", label: "Kauf" },
  { value: "EIGENBAU", label: "Eigenbau" },
  { value: "VERBRAUCH", label: "Verbrauch" },
  { value: "INFRASTRUKTUR", label: "Infrastruktur" },
];

const STATUS_OPTIONS = [
  { value: "OFFEN", label: "Offen" },
  { value: "ANGEFRAGT", label: "Angefragt" },
  { value: "BESTAETIGT", label: "Bestätigt" },
  { value: "VORHANDEN", label: "Vorhanden" },
  { value: "GELIEFERT", label: "Geliefert" },
];

const STATUS_COLORS: Record<string, string> = {
  OFFEN: "border-zinc-700 bg-zinc-800",
  ANGEFRAGT: "border-blue-800 bg-blue-950/40",
  BESTAETIGT: "border-amber-800 bg-amber-950/40",
  VORHANDEN: "border-emerald-800 bg-emerald-950/40",
  GELIEFERT: "border-emerald-700 bg-emerald-900/50",
};

export default function MaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<MaterialItem | null>(null);
  const [games, setGames] = useState<GameOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadItem = useCallback(() => {
    fetch(`/api/materials/${itemId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Material nicht gefunden");
        return res.json();
      })
      .then((data) => { setItem(data); setDirty(false); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => { loadItem(); }, [loadItem]);
  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then((d) =>
      setGames(d.map((g: GameOption) => ({ id: g.id, name: g.name })))
    );
  }, []);

  const update = <K extends keyof MaterialItem>(field: K, value: MaterialItem[K]) => {
    if (!item) return;
    setItem({ ...item, [field]: value });
    setDirty(true);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          kostenGeschaetzt: item.kostenGeschaetzt ? parseFloat(item.kostenGeschaetzt) : null,
          kostenEffektiv: item.kostenEffektiv ? parseFloat(item.kostenEffektiv) : null,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      const updated = await res.json();
      setItem({ ...item, ...updated });
      setDirty(false);
      setSuccessMsg("Gespeichert");
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`"${item?.name}" wirklich löschen?`)) return;
    try {
      await fetch(`/api/materials/${itemId}`, { method: "DELETE" });
      router.push("/admin/materials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;
  if (!item) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-400">{error ?? "Nicht gefunden"}</p>
      <Link href="/admin/materials" className="text-sm text-zinc-400 hover:text-white">Zurück</Link>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-8">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/admin/materials" className="hover:text-white transition">Material</Link>
          <span>/</span>
          <span className="text-white">{item.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {successMsg && <span className="text-sm text-emerald-400">{successMsg}</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              dirty ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {saving ? "Speichert..." : "Speichern"}
          </button>
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="flex gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => update("status", s.value)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
              item.status === s.value
                ? STATUS_COLORS[s.value] + " text-white"
                : "border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Grunddaten */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Grunddaten</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input
              type="text"
              value={item.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Game">
            <select
              value={item.gameId ?? ""}
              onChange={(e) => update("gameId", e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            >
              <option value="">Allgemein</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Kategorie">
            <select
              value={item.kategorie}
              onChange={(e) => update("kategorie", e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            >
              {KATEGORIEN.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Menge">
            <input
              type="text"
              value={item.menge ?? ""}
              onChange={(e) => update("menge", e.target.value || null)}
              placeholder="z.B. 100 Stk."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Sponsor">
            <input
              type="text"
              value={item.sponsor ?? ""}
              onChange={(e) => update("sponsor", e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
        </div>

        <Field label="Beschreibung">
          <textarea
            value={item.beschreibung ?? ""}
            onChange={(e) => update("beschreibung", e.target.value || null)}
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
          />
        </Field>
      </section>

      {/* Kosten */}
      <section className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Kosten</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Geschätzt (CHF)">
            <input
              type="number"
              step="0.01"
              value={item.kostenGeschaetzt ?? ""}
              onChange={(e) => update("kostenGeschaetzt", e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
          <Field label="Effektiv (CHF)">
            <input
              type="number"
              step="0.01"
              value={item.kostenEffektiv ?? ""}
              onChange={(e) => update("kostenEffektiv", e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </Field>
        </div>
      </section>

      {/* Kommentare (read-only) */}
      {item.kommentare && item.kommentare.length > 0 && (
        <section className="border border-zinc-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Kommentare ({item.kommentare.length})</h2>
          <div className="space-y-3">
            {item.kommentare.map((k) => (
              <div key={k.id} className="border border-zinc-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                  <span className="font-medium text-zinc-400">{k.autor.name}</span>
                  <span>&middot;</span>
                  <span>{new Date(k.createdAt).toLocaleDateString("de-CH")}</span>
                </div>
                <p className="text-sm">{k.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="border border-red-900/50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Material endgültig löschen</p>
            <p className="text-xs text-zinc-500">Inkl. aller Kommentare.</p>
          </div>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-red-400 border border-red-800 rounded-lg hover:bg-red-950 transition"
          >
            Löschen
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
