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
    <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-400">Gespeicherte Zeitplaene</h3>
      <div className="space-y-2">
        {configs.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition ${
              loadedConfigId === c.id
                ? "border-blue-700 bg-blue-950/30"
                : c.istAktiv
                  ? "border-emerald-800 bg-emerald-950/20"
                  : "border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => onLoad(c.id)}
                className="text-sm font-medium hover:text-blue-400 transition"
              >
                {c.name}
              </button>
              <span className="text-xs text-zinc-500">
                {c.anzahlTeams} Teams &middot; {c._count.slots} Slots
              </span>
              {c.istAktiv && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300">
                  Aktiv
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!c.istAktiv && (
                <button
                  onClick={() => onSetActive(c.id)}
                  className="text-xs text-zinc-500 hover:text-emerald-400 transition"
                >
                  Aktivieren
                </button>
              )}
              <button
                onClick={() => onDelete(c.id)}
                className="text-xs text-zinc-600 hover:text-red-400 transition"
              >
                Loeschen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
