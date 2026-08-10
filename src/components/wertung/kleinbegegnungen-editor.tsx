"use client";

/**
 * Kleinbegegnungen-Editor (Cornhole): eine gemeinsame Liste von
 * Begegnungen "Punkte eigen : Punkte Gegner".
 *
 * Betriebsarten über die Labels:
 * - shared (Duell-Eingabe/Live): labelEigene/labelGegner = Team-Namen,
 *   der Aufrufer spiegelt die Liste für Team B selbst.
 * - per-Team (KorrekturModal, readOnly-Anzeigen): Labels "Eigene"/"Gegner".
 */

import {
  berechneKleinbegegnungenStatistik,
  spiegleKleinbegegnungen,
} from "@/lib/game-punkte-berechnung";
import type { KleinbegegnungRoh } from "@/lib/wertungslogik-types";
import { formatSiege } from "./format";
import { inputClass, labelClass } from "./styles";

export type KleinbegegnungenEditorProps = {
  kleinbegegnungen: KleinbegegnungRoh[];
  onChange?: (next: KleinbegegnungRoh[]) => void;
  readOnly?: boolean;
  /** Spaltentitel der linken Spalte (eigene Punkte) */
  labelEigene: string;
  /** Spaltentitel der rechten Spalte (gegnerische Punkte) */
  labelGegner: string;
};

const zeilenGrid = "grid grid-cols-[24px_1fr_12px_1fr_40px] items-center gap-2";

export function KleinbegegnungenEditor({
  kleinbegegnungen,
  onChange,
  readOnly = false,
  labelEigene,
  labelGegner,
}: KleinbegegnungenEditorProps) {
  const statEigene = berechneKleinbegegnungenStatistik(kleinbegegnungen);
  const statGegner = berechneKleinbegegnungenStatistik(
    spiegleKleinbegegnungen(kleinbegegnungen),
  );

  const setze = (index: number, patch: Partial<KleinbegegnungRoh>) => {
    if (readOnly) return;
    onChange?.(
      kleinbegegnungen.map((kb, i) => (i === index ? { ...kb, ...patch } : kb)),
    );
  };

  const hinzufuegen = () => {
    if (readOnly) return;
    onChange?.([...kleinbegegnungen, { eigene: 0, gegner: 0 }]);
  };

  const entfernen = (index: number) => {
    if (readOnly) return;
    onChange?.(kleinbegegnungen.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Spaltentitel */}
      <div className={zeilenGrid}>
        <span />
        <span className={`${labelClass} truncate text-center`}>{labelEigene}</span>
        <span />
        <span className={`${labelClass} truncate text-center`}>{labelGegner}</span>
        <span />
      </div>

      {kleinbegegnungen.length === 0 && (
        <p className="py-1 text-center text-sm text-ink-3">
          Noch keine Kleinbegegnung erfasst
        </p>
      )}

      {kleinbegegnungen.map((kb, i) => (
        <div key={i} className={zeilenGrid}>
          <span className="tnum text-[12px] text-ink-3">{i + 1}.</span>
          {readOnly ? (
            <>
              <span className="tnum text-center text-lg text-ink">{kb.eigene}</span>
              <span className="text-center text-ink-3">:</span>
              <span className="tnum text-center text-lg text-ink">{kb.gegner}</span>
              <span />
            </>
          ) : (
            <>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={kb.eigene}
                onChange={(e) =>
                  setze(i, { eigene: Math.max(0, Number(e.target.value) || 0) })
                }
                aria-label={`Punkte ${labelEigene}, Begegnung ${i + 1}`}
                className={`${inputClass} px-2 text-center`}
              />
              <span className="text-center text-ink-3">:</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={kb.gegner}
                onChange={(e) =>
                  setze(i, { gegner: Math.max(0, Number(e.target.value) || 0) })
                }
                aria-label={`Punkte ${labelGegner}, Begegnung ${i + 1}`}
                className={`${inputClass} px-2 text-center`}
              />
              <button
                type="button"
                onClick={() => entfernen(i)}
                aria-label={`Begegnung ${i + 1} entfernen`}
                className="flex h-12 w-10 items-center justify-center rounded-[9px] border border-line-strong text-lg text-ink-3 transition-colors duration-150 hover:border-[var(--hot-border)] hover:text-hot-tint"
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={hinzufuegen}
          className="min-h-12 rounded-[9px] border border-dashed border-line-strong text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-action hover:text-ink"
        >
          + Kleinbegegnung hinzufügen
        </button>
      )}

      {/* Zwischenstand — Unentschieden zählt als halber Sieg für beide */}
      {kleinbegegnungen.length > 0 && (
        <p className="rounded-[9px] bg-sunken px-3.5 py-2.5 text-center text-sm text-ink-2">
          Siege {labelEigene}{" "}
          <span className="tnum font-semibold text-ink">{formatSiege(statEigene.siege)}</span>
          {" · "}
          Siege {labelGegner}{" "}
          <span className="tnum font-semibold text-ink">{formatSiege(statGegner.siege)}</span>
        </p>
      )}
    </div>
  );
}
