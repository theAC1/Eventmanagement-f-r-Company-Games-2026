"use client";

/**
 * Zeit-Editor: Eingabe als Minuten + Sekunden (schreibt zusammen
 * `zeit_sekunden`). Ist `maxSekunden` gesetzt, kommt der Toggle
 * "Nicht geschafft" dazu — der Server wertet dann die Maximalzeit.
 */

import { ZEIT_DNF_SENTINEL } from "@/lib/wertungslogik-types";
import { formatSekundenMSS } from "./format";
import { inputClass, jaButtonClass, labelClass, neinButtonClass } from "./styles";

export type ZeitEditorProps = {
  rohdaten: Record<string, unknown>;
  onUpdate: (key: "zeit_sekunden" | "nicht_geschafft", value: number | boolean) => void;
  /** Obergrenze in Sekunden — aktiviert den "Nicht geschafft"-Toggle */
  maxSekunden?: number;
  readOnly?: boolean;
};

export function ZeitEditor({
  rohdaten,
  onUpdate,
  maxSekunden,
  readOnly = false,
}: ZeitEditorProps) {
  const zeitSekunden =
    rohdaten.zeit_sekunden === undefined ? undefined : Number(rohdaten.zeit_sekunden);
  const nichtGeschafft = rohdaten.nicht_geschafft === true;
  const dnfAktiv = nichtGeschafft && maxSekunden !== undefined;

  const basis =
    zeitSekunden !== undefined && Number.isFinite(zeitSekunden)
      ? Math.max(0, Math.floor(zeitSekunden))
      : 0;
  const anzeigeSekunden = dnfAktiv ? maxSekunden : basis;
  const minuten = Math.floor(anzeigeSekunden / 60);
  const sekunden = anzeigeSekunden % 60;

  if (readOnly) {
    const text =
      zeitSekunden === ZEIT_DNF_SENTINEL
        ? "DNF"
        : dnfAktiv
          ? `${formatSekundenMSS(maxSekunden)} · nicht geschafft`
          : zeitSekunden !== undefined
            ? formatSekundenMSS(basis)
            : "–";
    return (
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Zeit</span>
        <div className="tnum px-1 py-1 text-lg text-ink">{text}</div>
      </div>
    );
  }

  const setzeZeit = (m: number, s: number) => {
    const mm = Math.max(0, Math.floor(m) || 0);
    const ss = Math.min(59, Math.max(0, Math.floor(s) || 0));
    onUpdate("zeit_sekunden", mm * 60 + ss);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Zeit (Minuten : Sekunden)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Minuten"
            value={minuten}
            onChange={(e) => setzeZeit(Number(e.target.value) || 0, sekunden)}
            disabled={dnfAktiv}
            className={`${inputClass} text-center`}
          />
          <span className="shrink-0 text-lg font-semibold text-ink-3">:</span>
          <input
            type="number"
            min={0}
            max={59}
            inputMode="numeric"
            aria-label="Sekunden"
            value={sekunden}
            onChange={(e) => setzeZeit(minuten, Number(e.target.value) || 0)}
            disabled={dnfAktiv}
            className={`${inputClass} text-center`}
          />
        </div>
        {maxSekunden !== undefined && (
          <p className="tnum text-[12px] text-ink-3">
            Maximum {formatSekundenMSS(maxSekunden)} — wird bei «Nicht geschafft» gewertet
          </p>
        )}
      </div>

      {maxSekunden !== undefined && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Geschafft?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onUpdate("nicht_geschafft", false)}
              className={jaButtonClass(!nichtGeschafft)}
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => onUpdate("nicht_geschafft", true)}
              className={neinButtonClass(nichtGeschafft)}
            >
              Nicht geschafft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
