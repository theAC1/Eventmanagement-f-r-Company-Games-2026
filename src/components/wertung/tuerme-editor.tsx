"use client";

/**
 * Türme-Editor (Robert Huber Radio): pro Turm Stepper für Sektionen und
 * (falls konfiguriert) Bonusklötze. Der 100%-Bonus wird nie eingegeben,
 * sondern automatisch abgeleitet und als Badge angezeigt.
 */

import {
  berechneTuermeMaximum,
  berechneTurmPunkte,
} from "@/lib/game-punkte-berechnung";
import type { TurmConfig, TurmRoh } from "@/lib/wertungslogik-types";
import { padTuerme } from "./rohdaten-init";
import { Stepper } from "./stepper";
import { labelClass } from "./styles";

export type TuermeEditorProps = {
  /** Turm-Konfiguration aus der Wertungslogik (Reihenfolge = Rohdaten-Reihenfolge) */
  tuerme: TurmConfig[];
  werte: TurmRoh[];
  onChange?: (next: TurmRoh[]) => void;
  readOnly?: boolean;
};

export function TuermeEditor({
  tuerme,
  werte,
  onChange,
  readOnly = false,
}: TuermeEditorProps) {
  const voll = padTuerme(werte, tuerme.length);
  const gesamt = tuerme.reduce(
    (summe, config, i) => summe + berechneTurmPunkte(voll[i], config),
    0,
  );
  const maximum = berechneTuermeMaximum(tuerme);

  const setze = (index: number, patch: Partial<TurmRoh>) => {
    if (readOnly) return;
    onChange?.(voll.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  return (
    <div className="flex flex-col gap-3">
      {tuerme.map((config, i) => {
        const wert = voll[i];
        const punkte = berechneTurmPunkte(wert, config);
        const vollstaendig = punkte === config.sektionen + config.bonus + 1;

        return (
          <div
            key={config.name}
            className="flex flex-col gap-3 rounded-xl border border-line-soft p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-ink">{config.name}</p>
              <div className="flex shrink-0 items-center gap-2">
                {vollstaendig && (
                  <span className="rounded-md border border-done bg-done-dim px-2 py-0.5 text-[11px] font-semibold text-done-tint">
                    100 % · +1
                  </span>
                )}
                <span className="tnum text-sm font-semibold text-ink-2">{punkte} P</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={labelClass}>Sektionen</p>
                <p className="tnum mt-0.5 text-[12px] text-ink-3">
                  {wert.sektionen} von {config.sektionen}
                </p>
              </div>
              {readOnly ? (
                <span className="tnum text-lg text-ink">{wert.sektionen}</span>
              ) : (
                <Stepper
                  wert={wert.sektionen}
                  max={config.sektionen}
                  onChange={(v) => setze(i, { sektionen: v })}
                />
              )}
            </div>

            {config.bonus > 0 && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={labelClass}>{config.bonusLabel ?? "Bonusklötze"}</p>
                  <p className="tnum mt-0.5 text-[12px] text-ink-3">
                    {wert.bonus} von {config.bonus}
                  </p>
                </div>
                {readOnly ? (
                  <span className="tnum text-lg text-ink">{wert.bonus}</span>
                ) : (
                  <Stepper
                    wert={wert.bonus}
                    max={config.bonus}
                    onChange={(v) => setze(i, { bonus: v })}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Live-Gesamtstand inkl. automatischer 100%-Boni */}
      <div className="flex items-center justify-between rounded-[9px] bg-sunken px-3.5 py-2.5">
        <span className={labelClass}>Gesamtstand</span>
        <span className="tnum text-lg font-bold text-ink">
          {gesamt} / {maximum}
        </span>
      </div>
    </div>
  );
}
