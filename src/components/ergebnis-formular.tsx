"use client";

type EingabeFeld = { name: string; typ: string; label: string };
type Level = { name: string; grundpunkte: number };
type Option = { name: string; punkte_erfolg: number; punkte_fail: number };

type Wertungslogik = {
  typ?: string;
  einheit?: string;
  richtung?: string;
  eingabefelder?: EingabeFeld[];
  levels?: Level[];
  optionen?: Option[];
  strafen?: Record<string, number>;
  nicht_geschafft?: string;
};

export type ErgebnisFormularProps = {
  wertungslogik: Wertungslogik | null;
  rohdaten: Record<string, unknown>;
  onChange: (rohdaten: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Display label above the form section */
  label?: string;
  /** For punkte_duell: true = show Team A field, false = show Team B field */
  isDuellTeamA?: boolean;
};

const inputClass =
  "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-lg font-mono focus:outline-none focus:border-zinc-500 disabled:opacity-60 disabled:cursor-not-allowed";

export function ErgebnisFormular({
  wertungslogik,
  rohdaten,
  onChange,
  readOnly = false,
  label,
  isDuellTeamA,
}: ErgebnisFormularProps) {
  const wl = wertungslogik;

  if (!wl) {
    return (
      <div className="border border-zinc-800 rounded-lg p-4 text-zinc-500 text-sm">
        Keine Wertungslogik definiert
      </div>
    );
  }

  const update = (key: string, value: unknown) => {
    if (readOnly) return;
    onChange({ ...rohdaten, [key]: value });
  };

  return (
    <section className="border border-zinc-800 rounded-lg p-4 space-y-4">
      {label && (
        <h3 className="text-sm font-medium text-zinc-400">{label}</h3>
      )}

      {/* Eingabefelder */}
      {wl.eingabefelder?.map((f) => {
        // Für Duell: nur das relevante Feld zeigen
        if (isDuellTeamA !== undefined && wl.typ === "punkte_duell") {
          const felder = wl.eingabefelder ?? [];
          const idx = isDuellTeamA ? 0 : 1;
          if (felder.indexOf(f) !== idx) return null;
        }
        return (
          <div key={f.name} className="space-y-1">
            <label className="text-xs text-zinc-500">{f.label}</label>
            {readOnly ? (
              <div className="px-3 py-2.5 text-lg font-mono text-zinc-300">
                {(rohdaten[f.name] as string) ?? "–"}
              </div>
            ) : (
              <input
                type={f.typ === "number" ? "number" : "text"}
                value={(rohdaten[f.name] as string) ?? ""}
                onChange={(e) =>
                  update(
                    f.name,
                    f.typ === "number"
                      ? Number(e.target.value) || 0
                      : e.target.value,
                  )
                }
                disabled={readOnly}
                className={inputClass}
              />
            )}
          </div>
        );
      })}

      {/* Level-Auswahl (Multi-Level) */}
      {wl.typ === "multi_level" && wl.levels && (
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Schwierigkeit</label>
          <div className="flex gap-2">
            {wl.levels.map((l) => (
              <button
                key={l.name}
                onClick={() => update("level", l.name)}
                disabled={readOnly}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  rohdaten.level === l.name
                    ? "bg-white text-black border-white"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {l.name} ({l.grundpunkte}P)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Risiko-Wahl (Eierfall) */}
      {wl.typ === "risiko_wahl" && wl.optionen && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Höhe</label>
            <div className="flex gap-2">
              {wl.optionen.map((o) => (
                <button
                  key={o.name}
                  onClick={() => update("option", o.name)}
                  disabled={readOnly}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    rohdaten.option === o.name
                      ? "bg-white text-black border-white"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {o.name} ({o.punkte_erfolg}P)
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Überlebt?</label>
            <div className="flex gap-2">
              <button
                onClick={() => update("erfolg", true)}
                disabled={readOnly}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  rohdaten.erfolg === true
                    ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                    : "border-zinc-700 text-zinc-400"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                Ja
              </button>
              <button
                onClick={() => update("erfolg", false)}
                disabled={readOnly}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  rohdaten.erfolg === false
                    ? "bg-red-900/60 border-red-700 text-red-300"
                    : "border-zinc-700 text-zinc-400"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                Nein
              </button>
            </div>
          </div>
        </>
      )}

      {/* Strafen (Lava Becken) */}
      {wl.strafen && (
        <>
          {Object.entries(wl.strafen).map(([key, sek]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-zinc-500 capitalize">
                {key.replace(/_/g, " ")} (+{sek}s)
              </label>
              {readOnly ? (
                <div className="px-3 py-2.5 text-lg font-mono text-zinc-300">
                  {(rohdaten[key] as number) ?? 0}
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  value={(rohdaten[key] as number) ?? 0}
                  onChange={(e) => update(key, Number(e.target.value) || 0)}
                  disabled={readOnly}
                  className={inputClass}
                />
              )}
            </div>
          ))}
          {wl.nicht_geschafft && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Geschafft?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => update("nicht_geschafft", false)}
                  disabled={readOnly}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    rohdaten.nicht_geschafft === false ||
                    rohdaten.nicht_geschafft === undefined
                      ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                      : "border-zinc-700 text-zinc-400"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  Ja
                </button>
                <button
                  onClick={() => update("nicht_geschafft", true)}
                  disabled={readOnly}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    rohdaten.nicht_geschafft === true
                      ? "bg-red-900/60 border-red-700 text-red-300"
                      : "border-zinc-700 text-zinc-400"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  Nicht geschafft
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Zeit-Eingabe (wenn kein Eingabefeld definiert aber Typ=zeit) */}
      {wl.typ === "zeit" && !wl.eingabefelder?.length && (
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Zeit (Sekunden)</label>
          {readOnly ? (
            <div className="px-3 py-2.5 text-lg font-mono text-zinc-300">
              {(rohdaten.zeit_sekunden as number) ?? "–"}
            </div>
          ) : (
            <input
              type="number"
              value={(rohdaten.zeit_sekunden as number) ?? ""}
              onChange={(e) =>
                update("zeit_sekunden", Number(e.target.value) || 0)
              }
              disabled={readOnly}
              className={inputClass}
            />
          )}
        </div>
      )}
    </section>
  );
}
