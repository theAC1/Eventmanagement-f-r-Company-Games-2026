"use client";

import { useState } from "react";
import { ErgebnisFormular } from "@/components/ergebnis-formular";

type KorrekturModalProps = {
  ergebnis: {
    id: string;
    status: string;
    rohdaten: Record<string, unknown>;
    game: { id: string; name: string; slug: string; wertungslogik?: unknown };
    team: { id: string; name: string; nummer: number };
  };
  onClose: (refreshNeeded?: boolean) => void;
};

export function KorrekturModal({ ergebnis, onClose }: KorrekturModalProps) {
  const [rohdaten, setRohdaten] = useState<Record<string, unknown>>(
    ergebnis.rohdaten ?? {},
  );
  const [grund, setGrund] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/ergebnisse/${ergebnis.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rohdaten,
          grund: grund.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          json.error ?? `Fehler ${res.status}`,
        );
      }

      onClose(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unbekannter Fehler",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onClose()}
      />

      {/* Modal card */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Korrektur</h2>
          <p className="text-sm text-zinc-400">
            {ergebnis.game.name} — {ergebnis.team.name} #{ergebnis.team.nummer}
          </p>
          <p className="text-xs text-zinc-500">
            Status: {ergebnis.status}
          </p>
        </div>

        {/* Formular */}
        <ErgebnisFormular
          wertungslogik={
            (ergebnis.game.wertungslogik as Parameters<typeof ErgebnisFormular>[0]["wertungslogik"]) ??
            null
          }
          rohdaten={rohdaten}
          onChange={setRohdaten}
        />

        {/* Grund */}
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">
            Grund der Korrektur (optional)
          </label>
          <textarea
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
            placeholder="z.B. Fehlmessung korrigiert..."
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => onClose()}
            className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {saving ? "Speichern..." : "Korrektur speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
