/**
 * Gemeinsame Token-Klassen der Wertungs-Editoren.
 * Quelle: ergebnis-formular.tsx — hierher ausgelagert, damit alle
 * Editoren unter components/wertung/ exakt dieselben Stile nutzen.
 */

export const inputClass =
  "tnum h-12 w-full rounded-[9px] border border-line-strong bg-sunken px-3 text-lg text-ink placeholder:text-faint focus:border-action focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const labelClass = "cg-label text-label";

/** Options-/Level-Taste: aktiv = Aktionsblau, idle = ruhiger Rand. */
export const optionButtonClass = (aktiv: boolean) =>
  `min-h-12 flex-1 rounded-[9px] px-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
    aktiv
      ? "bg-action font-semibold text-on-action"
      : "border border-line-strong font-medium text-ink-2"
  }`;

/** Erfolg-Toggle: Ja = done-Stil, Nein = hot-Stil (jeweils dim-Hintergrund). */
export const jaButtonClass = (aktiv: boolean) =>
  `min-h-12 flex-1 rounded-[9px] px-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
    aktiv
      ? "border-[1.5px] border-done bg-done-dim font-semibold text-done-tint"
      : "border border-line-strong font-medium text-ink-3"
  }`;

export const neinButtonClass = (aktiv: boolean) =>
  `min-h-12 flex-1 rounded-[9px] px-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
    aktiv
      ? "border-[1.5px] border-[var(--hot-border)] bg-hot-dim font-semibold text-hot-tint"
      : "border border-line-strong font-medium text-ink-3"
  }`;
