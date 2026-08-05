import { StatusPill } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";
import { SavedConfig } from "./types";

type GespeicherteZeitplaeneProps = {
  configs: SavedConfig[];
  loadedConfigId: string | null;
  onLoad: (configId: string) => void;
  onDelete: (configId: string) => void;
  onSetActive: (configId: string) => void;
};

export function GespeicherteZeitplaene({
  configs,
  loadedConfigId,
  onLoad,
  onDelete,
  onSetActive,
}: GespeicherteZeitplaeneProps) {
  if (configs.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <h3 className="cg-label">Gespeicherte Zeitpl&auml;ne</h3>
      <div className="space-y-2">
        {configs.map((c) => (
          <div
            key={c.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border bg-surface px-3.5 py-2.5 transition-colors duration-150 ${
              loadedConfigId === c.id
                ? "border-action"
                : "border-line hover:border-line-strong"
            }`}
          >
            <button
              onClick={() => onLoad(c.id)}
              className="text-sm font-medium text-ink transition-colors duration-150 hover:text-action"
            >
              {c.name}
            </button>
            <span className="text-[11px] text-ink-3">
              <span className="tnum">{c.anzahlTeams}</span> Teams &middot;{" "}
              <span className="tnum">{c._count.slots}</span> Slots
            </span>
            {c.istAktiv && <StatusPill tone="done">Aktiv</StatusPill>}
            <span className="flex-1" aria-hidden />
            {!c.istAktiv && (
              <Button variant="ghost" onClick={() => onSetActive(c.id)}>
                Aktivieren
              </Button>
            )}
            <Button variant="danger-ghost" onClick={() => onDelete(c.id)}>
              L&ouml;schen
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
