/**
 * Zeigt Audit-Infos (Erstellt von / Bearbeitet von) in einer kompakten Zeile.
 */

type AuditInfoProps = {
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditInfo({ createdBy, updatedBy, createdAt, updatedAt }: AuditInfoProps) {
  if (!createdBy && !updatedBy) return null;

  return (
    <div className="flex items-center gap-4 text-xs text-ink-3">
      {createdBy && (
        <span>
          Erstellt von <span className="text-ink-2">{createdBy.name}</span>
          {createdAt && <span className="tnum ml-1">{formatDate(createdAt)}</span>}
        </span>
      )}
      {updatedBy && (
        <span>
          Bearbeitet von <span className="text-ink-2">{updatedBy.name}</span>
          {updatedAt && <span className="tnum ml-1">{formatDate(updatedAt)}</span>}
        </span>
      )}
    </div>
  );
}
