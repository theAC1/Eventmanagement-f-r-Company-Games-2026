/**
 * Pills und Chips aus dem Redesign: Status-Pill, HOT-Pill, Modus-Chip.
 * Farben kommen ausschliesslich aus den Tokens in globals.css.
 */

export function HotPill({ label = "HOT", className = "" }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-[7px] rounded-full border px-2.5 text-[11px] font-semibold tracking-[0.06em] ${className}`}
      style={{ background: "var(--hot-dim)", borderColor: "var(--hot-border)", color: "var(--hot-tint)" }}
    >
      <span className="anim-hot-pulse h-1.5 w-1.5 rounded-full" style={{ background: "var(--hot)" }} />
      {label}
    </span>
  );
}

export type PillTone = "neutral" | "action" | "warn" | "done" | "done-strong" | "hot";

const TONE_STYLES: Record<PillTone, { color: string; background: string }> = {
  neutral: { color: "var(--ink-3)", background: "var(--neutral-dim)" },
  action: { color: "var(--action-tint)", background: "var(--action-dim)" },
  warn: { color: "var(--warn)", background: "var(--warn-dim)" },
  done: { color: "var(--done-tint)", background: "var(--done-dim)" },
  "done-strong": { color: "var(--done)", background: "var(--done-dim-strong)" },
  hot: { color: "var(--hot-tint)", background: "var(--hot-dim)" },
};

export function StatusPill({
  tone,
  children,
  className = "",
}: {
  tone: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-semibold tracking-[0.04em] ${className}`}
      style={TONE_STYLES[tone]}
    >
      {children}
    </span>
  );
}

export function ModusChip({
  modus,
  size = "table",
  className = "",
}: {
  modus: string;
  size?: "table" | "large";
  className?: string;
}) {
  const isDuell = modus.toUpperCase().includes("DUELL");
  const style = isDuell
    ? { color: "var(--action-tint)", background: "var(--action-dim)" }
    : { color: "var(--done-tint)", background: "var(--done-dim)" };
  const sizing =
    size === "table"
      ? "px-1.5 py-0.5 text-[10px] rounded-[5px]"
      : "px-2 py-1 text-xs rounded-md";
  return (
    <span
      className={`inline-flex items-center font-semibold uppercase tracking-[0.06em] ${sizing} ${className}`}
      style={style}
    >
      {modus}
    </span>
  );
}
