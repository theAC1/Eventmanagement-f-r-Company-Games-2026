"use client";

import { StatusPill, type PillTone } from "@/components/ui/pills";

/**
 * Ergebnis-Status als Pill im Redesign-Stil.
 * Amber = läuft/Verzug, Grün = erfasst/bestätigt, Blau = Orga-Eingriff.
 */
const STATUS_CONFIG: Record<string, { tone: PillTone; label: string }> = {
  AUSSTEHEND: { tone: "neutral", label: "Ausstehend" },
  LAUFEND: { tone: "warn", label: "Läuft" },
  EINGETRAGEN: { tone: "done", label: "Eingetragen" },
  VERIFIZIERT: { tone: "done-strong", label: "Verifiziert" },
  KORRIGIERT: { tone: "action", label: "Korrigiert" },
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? { tone: "neutral" as PillTone, label: status };
  return (
    <StatusPill tone={config.tone} className={className}>
      {config.label}
    </StatusPill>
  );
}
