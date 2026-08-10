"use client";

/**
 * Runden-Editor (ChaosQuadrant): fixe Rundenzahl, pro Runde Bälle im
 * eigenen Quadranten plus laufend gezählte Strafpunkte.
 * Niedrigste Punktsumme gewinnt — die Summenzeile zeigt das Total.
 */

import type { RundeRoh } from "@/lib/wertungslogik-types";
import { padRunden } from "./rohdaten-init";
import { Stepper } from "./stepper";
import { inputClass, labelClass } from "./styles";

export type RundenEditorProps = {
  anzahlRunden: number;
  runden: RundeRoh[];
  onChange?: (next: RundeRoh[]) => void;
  readOnly?: boolean;
  /** "live": grosse Foul-Zähler für die laufende Erfassung am Feld */
  variante?: "kompakt" | "live";
};

export function RundenEditor({
  anzahlRunden,
  runden,
  onChange,
  readOnly = false,
  variante = "kompakt",
}: RundenEditorProps) {
  const voll = padRunden(runden, anzahlRunden);
  const total = voll.reduce((summe, r) => summe + r.baelle + r.strafpunkte, 0);

  const setze = (index: number, patch: Partial<RundeRoh>) => {
    if (readOnly) return;
    onChange?.(voll.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  return (
    <div className="flex flex-col gap-3">
      {voll.map((runde, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-line-soft p-3.5"
        >
          <p className="text-sm font-semibold text-ink">Runde {i + 1}</p>

          {readOnly ? (
            <div className="flex justify-between text-sm">
              <span className="text-ink-3">
                Bälle <span className="tnum text-ink">{runde.baelle}</span>
              </span>
              <span className="text-ink-3">
                Strafpunkte <span className="tnum text-ink">{runde.strafpunkte}</span>
              </span>
            </div>
          ) : (
            <>
              {/* Fouls werden laufend erfasst — prominenter Zähler zuerst */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Strafpunkte</p>
                  <p className="mt-0.5 text-[12px] text-ink-3">laufend erfassen</p>
                </div>
                <Stepper
                  wert={runde.strafpunkte}
                  gross={variante === "live"}
                  onChange={(wert) => setze(i, { strafpunkte: wert })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Bälle im eigenen Quadranten</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={runde.baelle}
                  onChange={(e) =>
                    setze(i, { baelle: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className={inputClass}
                />
              </div>
            </>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between rounded-[9px] bg-sunken px-3.5 py-2.5">
        <span className={labelClass}>Total (wenigste gewinnen)</span>
        <span className="tnum text-lg font-bold text-ink">{total} Punkte</span>
      </div>
    </div>
  );
}
