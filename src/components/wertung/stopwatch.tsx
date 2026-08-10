"use client";

/**
 * Stoppuhr der Live-Erfassung (typ "zeit"): Start/Stopp/Weiter,
 * schreibt beim Stopp `zeit_sekunden`; optional Strafen-Zähler.
 */

import { useEffect, useRef, useState } from "react";

export type StopwatchProps = {
  onTimeRecorded: (seconds: number) => void;
  penalties?: Record<string, number>;
  rohdaten: Record<string, unknown>;
  onPenalty: (key: string, value: number) => void;
};

export function Stopwatch({
  onTimeRecorded,
  penalties,
  rohdaten,
  onPenalty,
}: StopwatchProps) {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // rAF-Schleife läuft, solange die Uhr gestartet ist (Cleanup stoppt sie)
  useEffect(() => {
    if (!running) return;
    const loop = () => {
      if (startRef.current !== null) {
        setTime(Math.floor((Date.now() - startRef.current) / 1000));
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  const toggleTimer = () => {
    if (running) {
      // Stop
      setRunning(false);
      startRef.current = null;
      onTimeRecorded(time);
    } else {
      // Start
      startRef.current = Date.now();
      setRunning(true);
    }
  };

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="tnum text-[56px] font-bold leading-none tracking-[-0.02em] text-ink lg:text-[64px]">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
      </div>

      <button
        onClick={toggleTimer}
        className={`h-16 w-full rounded-[14px] text-[19px] font-bold transition-colors duration-150 ${
          running
            ? "bg-hot text-on-hot hover:brightness-110"
            : "border-[1.5px] border-done bg-done-dim text-done-tint"
        }`}
      >
        {running ? "Stopp" : time > 0 ? "Weiter" : "Start"}
      </button>

      {/* Strafen-Zähler */}
      {penalties &&
        Object.entries(penalties).map(([key, sek]) => {
          const wert = Number(rohdaten[key]) || 0;
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium capitalize text-ink">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="tnum mt-0.5 text-[12px] text-ink-3">+{sek} s pro Vergehen</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  onClick={() => onPenalty(key, Math.max(0, wert - 1))}
                  aria-label="Minus"
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-line-key bg-raised text-[26px] font-semibold text-ink-2 transition-colors duration-150 active:bg-sunken"
                >
                  −
                </button>
                <span
                  key={wert}
                  className="anim-count tnum w-10 text-center text-[34px] font-bold leading-none text-ink"
                >
                  {wert}
                </span>
                <button
                  onClick={() => onPenalty(key, wert + 1)}
                  aria-label="Plus"
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-action bg-action-dim-strong text-[26px] font-semibold text-action-tint transition-colors duration-150 active:bg-action-dim"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
