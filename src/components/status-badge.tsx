"use client";

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  AUSSTEHEND: { bg: "bg-zinc-800", text: "text-zinc-400", label: "Ausstehend" },
  LAUFEND: { bg: "bg-blue-900/40", text: "text-blue-400", label: "Läuft" },
  EINGETRAGEN: { bg: "bg-emerald-900/40", text: "text-emerald-400", label: "Eingetragen" },
  VERIFIZIERT: { bg: "bg-emerald-900/60", text: "text-emerald-300", label: "Verifiziert" },
  KORRIGIERT: { bg: "bg-amber-900/40", text: "text-amber-400", label: "Korrigiert" },
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? {
    bg: "bg-zinc-800",
    text: "text-zinc-400",
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  );
}
