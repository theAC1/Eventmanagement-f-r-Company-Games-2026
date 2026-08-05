import { ProgressBar } from "./progress";

/**
 * KPI-Band unter der Topbar: Zellen mit Haarlinien getrennt,
 * grosse Mono-Zahl + Nenner + optionale Fussnote oder Mini-Balken.
 */
export function KpiBand({
  children,
  columns,
  className = "",
}: {
  children: React.ReactNode;
  columns?: string;
  className?: string;
}) {
  return (
    <div
      className={`grid border-b border-line ${className}`}
      style={{ gridTemplateColumns: columns ?? `repeat(${Array.isArray(children) ? children.length : 1}, 1fr)` }}
    >
      {children}
    </div>
  );
}

export function KpiCell({
  label,
  value,
  denominator,
  unit,
  note,
  valueColor = "var(--ink)",
  bar,
  last = false,
}: {
  label: string;
  value: string | number;
  denominator?: string;
  unit?: string;
  note?: string;
  valueColor?: string;
  bar?: { pct: number; color: string };
  last?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-4 sm:px-[22px] ${last ? "" : "border-r border-line"}`}>
      <span className="cg-label">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-[28px] font-semibold leading-none tracking-[-0.02em]" style={{ color: valueColor }}>
          {value}
        </span>
        {denominator && <span className="tnum text-sm text-ink-3">{denominator}</span>}
        {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
      </div>
      {note && <span className="text-[11px] text-ink-3">{note}</span>}
      {bar && <ProgressBar pct={bar.pct} color={bar.color} height={3} className="mt-1" />}
    </div>
  );
}
