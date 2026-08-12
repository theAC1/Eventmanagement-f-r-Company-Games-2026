import { StatusPill } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";
import { SavedConfig } from "./types";

type GespeicherteZeitplaeneProps = {
  configs: SavedConfig[];
  loadedConfigId: string | null;
  /** Gameday läuft — Aktivieren und Löschen sind gesperrt. */
  gesperrt: boolean;
  onLoad: (configId: string) => void;
  onDelete: (configId: string) => void;
  onSetActive: (configId: string) => void;
};

const SPERR_HINWEIS = "Gameday läuft — gesperrt";

export function GespeicherteZeitplaene({
  configs,
  loadedConfigId,
  gesperrt,
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
            {c.istAktiv && <StatusPill tone="done">Aktiv</StatusPill>}

            <span className="text-[11px] text-ink-3">
              <span className="tnum">{c.startZeit}</span>&ndash;
              <span className="tnum">{c.endZeit}</span> &middot; Takt{" "}
              <span className="tnum">{c.blockDauerMin + c.wechselzeitMin}</span> min
              &middot; <span className="tnum">{c.anzahlTeams}</span> Teams &middot;{" "}
              <span className="tnum">{c._count.slots}</span> Slots
              {c.mittagspause && (
                <>
                  {" "}
                  &middot; Mittag <span className="tnum">{c.mittagspause.von}</span>
                  &ndash;<span className="tnum">{c.mittagspause.bis}</span>
                </>
              )}
            </span>

            <span className="flex-1" aria-hidden />

            {!c.istAktiv && (
              <Button
                variant="ghost"
                disabled={gesperrt}
                title={gesperrt ? SPERR_HINWEIS : undefined}
                onClick={() => onSetActive(c.id)}
              >
                Aktivieren
              </Button>
            )}
            <Button
              variant="danger-ghost"
              disabled={gesperrt}
              title={gesperrt ? SPERR_HINWEIS : undefined}
              onClick={() => onDelete(c.id)}
            >
              L&ouml;schen
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
