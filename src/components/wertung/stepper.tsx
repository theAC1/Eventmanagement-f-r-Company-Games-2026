"use client";

/**
 * −/+-Zähler für Türme, Strafpunkte & Co.
 * Stile übernommen von den Strafen-Zählern der Live-Erfassung.
 */

export type StepperProps = {
  wert: number;
  onChange: (wert: number) => void;
  min?: number;
  max?: number;
  /** true = grosse Feld-Variante (Live-Erfassung mit Handschuhen/Hektik) */
  gross?: boolean;
};

export function Stepper({ wert, onChange, min = 0, max, gross = false }: StepperProps) {
  const buttonSize = gross ? "h-16 w-16 text-[26px]" : "h-12 w-12 text-[22px]";
  const wertSize = gross ? "w-10 text-[34px]" : "w-8 text-[26px]";

  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, wert - 1))}
        disabled={wert <= min}
        aria-label="Minus"
        className={`flex ${buttonSize} items-center justify-center rounded-xl border border-line-key bg-raised font-semibold text-ink-2 transition-colors duration-150 active:bg-sunken disabled:cursor-not-allowed disabled:opacity-40`}
      >
        −
      </button>
      <span
        key={wert}
        className={`anim-count tnum ${wertSize} text-center font-bold leading-none text-ink`}
      >
        {wert}
      </span>
      <button
        type="button"
        onClick={() => onChange(max === undefined ? wert + 1 : Math.min(max, wert + 1))}
        disabled={max !== undefined && wert >= max}
        aria-label="Plus"
        className={`flex ${buttonSize} items-center justify-center rounded-xl border border-action bg-action-dim-strong font-semibold text-action-tint transition-colors duration-150 active:bg-action-dim disabled:cursor-not-allowed disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}
