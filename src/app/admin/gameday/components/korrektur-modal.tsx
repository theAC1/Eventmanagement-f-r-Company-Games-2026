"use client";

import { useState } from "react";
import { ErgebnisFormular } from "@/components/ergebnis-formular";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--scrim)" }}
        onClick={() => onClose()}
      />

      {/* Modal card */}
      <div
        className="anim-pop relative flex max-h-[80vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-[14px] border border-line bg-surface p-6"
        style={{ boxShadow: "var(--shadow-pop)" }}
      >
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">
              Korrektur
            </h2>
            <StatusBadge status={ergebnis.status} />
          </div>
          <p className="text-sm text-ink-3">
            {ergebnis.game.name} — {ergebnis.team.name}{" "}
            <span className="tnum">#{ergebnis.team.nummer}</span>
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
        <div className="flex flex-col gap-1">
          <label className="cg-label">
            Grund der Korrektur (optional)
          </label>
          <textarea
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-sm text-ink focus:border-action focus:outline-none"
            placeholder="z.B. Fehlmessung korrigiert..."
          />
        </div>

        {/* Error */}
        {error && <p className="text-sm text-hot-tint">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="ghost" onClick={() => onClose()}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Speichern…" : "Korrektur speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
