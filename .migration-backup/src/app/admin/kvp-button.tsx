"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

type KvpTyp = "BUG" | "WUNSCHFUNKTION" | "IDEE";

const TYP_CONFIG: Record<KvpTyp, { label: string; emoji: string; color: string }> = {
  BUG: { label: "Bug / Fehler", emoji: "🐛", color: "bg-red-950/80 border-red-800 text-red-300" },
  WUNSCHFUNKTION: { label: "Wunschfunktion", emoji: "✨", color: "bg-blue-950/80 border-blue-800 text-blue-300" },
  IDEE: { label: "Idee / Verbesserung", emoji: "💡", color: "bg-amber-950/80 border-amber-800 text-amber-300" },
};

const INITIAL_FORM = { typ: "BUG" as KvpTyp, titel: "", beschreibung: "" };

export function KvpFloatingButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const charsLeft = 500 - form.beschreibung.length;

  const handleOpen = () => {
    setForm(INITIAL_FORM);
    setError(null);
    setSuccess(false);
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.titel.trim() || !form.beschreibung.trim()) {
      setError("Bitte Titel und Beschreibung ausfüllen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typ: form.typ,
          titel: form.titel.trim(),
          beschreibung: form.beschreibung.trim(),
          seite: pathname,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Fehler beim Senden");
      }
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        title="Feedback / KVP melden"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium shadow-lg hover:bg-zinc-700 hover:text-white hover:border-zinc-600 transition-all hover:shadow-xl"
        aria-label="KVP-Meldung erstellen"
      >
        <span className="text-sm">💬</span>
        KVP
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/60 backdrop-blur-sm p-4 sm:p-6"
          onClick={handleClose}
        >
          <div
            className="w-full sm:w-[420px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Feedback / KVP</h2>
                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[280px]">
                  {pathname}
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={saving}
                className="text-zinc-500 hover:text-white transition text-xl leading-none disabled:opacity-40"
                aria-label="Schliessen"
              >
                ×
              </button>
            </div>

            {success ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3 text-emerald-400">
                <span className="text-4xl">✓</span>
                <p className="text-sm font-medium">Danke! Meldung gespeichert.</p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                {/* Typ-Auswahl */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Typ
                  </label>
                  <div className="flex gap-2">
                    {(Object.keys(TYP_CONFIG) as KvpTyp[]).map((typ) => {
                      const cfg = TYP_CONFIG[typ];
                      const isActive = form.typ === typ;
                      return (
                        <button
                          key={typ}
                          onClick={() => setForm({ ...form, typ })}
                          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                            isActive
                              ? cfg.color
                              : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                          }`}
                        >
                          <span className="text-lg">{cfg.emoji}</span>
                          <span className="leading-tight text-center">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Titel */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Titel
                  </label>
                  <input
                    type="text"
                    value={form.titel}
                    onChange={(e) =>
                      setForm({ ...form, titel: e.target.value.slice(0, 100) })
                    }
                    placeholder="Kurze Zusammenfassung…"
                    maxLength={100}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
                  />
                </div>

                {/* Beschreibung */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Beschreibung
                    </label>
                    <span
                      className={`text-xs tabular-nums ${
                        charsLeft < 50 ? "text-amber-400" : "text-zinc-600"
                      }`}
                    >
                      {charsLeft} / 500
                    </span>
                  </div>
                  <textarea
                    value={form.beschreibung}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        beschreibung: e.target.value.slice(0, 500),
                      })
                    }
                    placeholder="Was ist passiert? Was erwartest du? Je konkreter desto besser…"
                    rows={4}
                    maxLength={500}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={handleClose}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || !form.titel.trim() || !form.beschreibung.trim()}
                    className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? "Sende…" : "Melden"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
