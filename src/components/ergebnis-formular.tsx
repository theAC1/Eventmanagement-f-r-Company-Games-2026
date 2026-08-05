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
  "tnum h-12 w-full rounded-[9px] border border-line-strong bg-sunken px-3 text-lg text-ink placeholder:text-faint focus:border-action focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const labelClass = "cg-label text-label";

/** Options-/Level-Taste: aktiv = Aktionsblau, idle = ruhiger Rand. */
const optionButtonClass = (aktiv: boolean) =>
  `min-h-12 flex-1 rounded-[9px] px-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
    aktiv
      ? "bg-action font-semibold text-on-action"
      : "border border-line-strong font-medium text-ink-2"
  }`;

/** Erfolg-Toggle: Ja = done-Stil, Nein = hot-Stil (jeweils dim-Hintergrund). */
const jaButtonClass = (aktiv: boolean) =>
  `min-h-12 flex-1 rounded-[9px] px-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
    aktiv
      ? "border-[1.5px] border-done bg-done-dim font-semibold text-done-tint"
      : "border border-line-strong font-medium text-ink-3"
  }`;

const neinButtonClass = (aktiv: boolean) =>
  `min-h-12 flex-1 rounded-[9px] px-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
    aktiv
      ? "border-[1.5px] border-[var(--hot-border)] bg-hot-dim font-semibold text-hot-tint"
      : "border border-line-strong font-medium text-ink-3"
  }`;

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
      <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-3">
        Keine Wertungslogik definiert
      </div>
    );
  }

  const update = (key: string, value: unknown) => {
    if (readOnly) return;
    onChange({ ...rohdaten, [key]: value });
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      {label && (
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
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
          <div key={f.name} className="flex flex-col gap-1.5">
            <label className={labelClass}>{f.label}</label>
            {readOnly ? (
              <div className="tnum px-1 py-1 text-lg text-ink">
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
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Schwierigkeit</label>
          <div className="flex gap-2">
            {wl.levels.map((l) => (
              <button
                key={l.name}
                onClick={() => update("level", l.name)}
                disabled={readOnly}
                className={`${optionButtonClass(rohdaten.level === l.name)} capitalize`}
              >
                {l.name} <span className="tnum">({l.grundpunkte} P)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Risiko-Wahl (Eierfall) */}
      {wl.typ === "risiko_wahl" && wl.optionen && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Höhe</label>
            <div className="flex gap-2">
              {wl.optionen.map((o) => (
                <button
                  key={o.name}
                  onClick={() => update("option", o.name)}
                  disabled={readOnly}
                  className={optionButtonClass(rohdaten.option === o.name)}
                >
                  {o.name} <span className="tnum">({o.punkte_erfolg} P)</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Überlebt?</label>
            <div className="flex gap-2">
              <button
                onClick={() => update("erfolg", true)}
                disabled={readOnly}
                className={jaButtonClass(rohdaten.erfolg === true)}
              >
                Ja
              </button>
              <button
                onClick={() => update("erfolg", false)}
                disabled={readOnly}
                className={neinButtonClass(rohdaten.erfolg === false)}
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
            <div key={key} className="flex flex-col gap-1.5">
              <label className={`${labelClass} capitalize`}>
                {key.replace(/_/g, " ")} (+{sek} s)
              </label>
              {readOnly ? (
                <div className="tnum px-1 py-1 text-lg text-ink">
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
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Geschafft?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => update("nicht_geschafft", false)}
                  disabled={readOnly}
                  className={jaButtonClass(
                    rohdaten.nicht_geschafft === false ||
                      rohdaten.nicht_geschafft === undefined,
                  )}
                >
                  Ja
                </button>
                <button
                  onClick={() => update("nicht_geschafft", true)}
                  disabled={readOnly}
                  className={neinButtonClass(rohdaten.nicht_geschafft === true)}
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
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Zeit (Sekunden)</label>
          {readOnly ? (
            <div className="tnum px-1 py-1 text-lg text-ink">
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
