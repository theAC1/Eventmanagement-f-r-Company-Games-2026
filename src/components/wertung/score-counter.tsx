"use client";

/** Grosser −/+-Punktezähler pro Team (punkte_duell, Live-Erfassung). */

export type ScoreCounterProps = {
  teamName: string;
  score: number;
  onChange: (value: number) => void;
};

export function ScoreCounter({ teamName, score, onChange }: ScoreCounterProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-[14px] border border-line bg-surface p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[16px] font-semibold text-ink">{teamName}</span>
        <span className="tnum text-[11px] font-semibold text-label">PUNKTE</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => onChange(Math.max(0, score - 1))}
          aria-label="Minus"
          className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[14px] border border-line-key bg-raised text-[30px] font-semibold text-ink-2 transition-colors duration-150 active:bg-sunken lg:h-16 lg:w-16"
        >
          −
        </button>
        <span
          key={score}
          className="anim-count tnum flex-1 text-center text-[64px] font-bold leading-none text-ink"
        >
          {score}
        </span>
        <button
          onClick={() => onChange(score + 1)}
          aria-label="Plus"
          className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[14px] border border-action bg-action-dim-strong text-[30px] font-semibold text-action-tint transition-colors duration-150 active:bg-action-dim lg:h-16 lg:w-16"
        >
          +
        </button>
      </div>
    </div>
  );
}
