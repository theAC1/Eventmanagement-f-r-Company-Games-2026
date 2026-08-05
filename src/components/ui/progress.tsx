/**
 * Fortschrittsbalken aus dem Redesign: 999px-Radius, Track --track,
 * Füllfarbe nach Zustand (fertig grün, live amber, sonst aktionsblau).
 */
export function ProgressBar({
  pct,
  color = "var(--action)",
  height = 6,
  className = "",
}: {
  pct: number;
  color?: string;
  height?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`overflow-hidden rounded-full ${className}`}
      style={{ height, background: "var(--track)" }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${clamped}%`, background: color, transitionTimingFunction: "var(--ease-out)" }}
      />
    </div>
  );
}

export function progressColor({ done, total, live }: { done: number; total: number; live?: boolean }): string {
  if (done >= total) return "var(--done)";
  if (live) return "var(--warn)";
  return "var(--action)";
}
