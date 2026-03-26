"use client";

export function ScoreCounter({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="min-h-16 min-w-16 flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-2xl font-bold text-zinc-300 transition active:scale-95 hover:border-zinc-500 disabled:opacity-30 disabled:active:scale-100"
        >
          &minus;
        </button>
        <span className="text-4xl font-mono font-bold text-white min-w-[3ch] text-center">
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          className="min-h-16 min-w-16 flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-2xl font-bold text-zinc-300 transition active:scale-95 hover:border-zinc-500"
        >
          +
        </button>
      </div>
    </div>
  );
}
