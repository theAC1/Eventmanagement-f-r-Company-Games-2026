"use client";

import { useEffect } from "react";
import {
  parseKleinbegegnungen,
  parseRunden,
  parseTuerme,
} from "@/lib/game-punkte-berechnung";
import type { Wertungslogik } from "@/lib/wertungslogik-types";
import { padRunden, padTuerme } from "@/components/wertung/rohdaten-init";
import { KleinbegegnungenEditor } from "@/components/wertung/kleinbegegnungen-editor";
import { RundenEditor } from "@/components/wertung/runden-editor";
import { TuermeEditor } from "@/components/wertung/tuerme-editor";
import { ZeitEditor } from "@/components/wertung/zeit-editor";
import {
  inputClass,
  jaButtonClass,
  labelClass,
  neinButtonClass,
  optionButtonClass,
} from "@/components/wertung/styles";

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

export function ErgebnisFormular({
  wertungslogik,
  rohdaten,
  onChange,
  readOnly = false,
  label,
  isDuellTeamA,
}: ErgebnisFormularProps) {
  const wl = wertungslogik;

  // sieg_zuege: beide Schlüssel mit 0 vorbelegen,
  // damit auch ein 0:0-Verlierer speicherbar ist.
  const siegZuegeInitNoetig =
    !readOnly &&
    wl?.typ === "sieg_zuege" &&
    (rohdaten.siege === undefined || rohdaten.zuege === undefined);

  useEffect(() => {
    if (!siegZuegeInitNoetig) return;
    onChange({
      ...rohdaten,
      siege: rohdaten.siege ?? 0,
      zuege: rohdaten.zuege ?? 0,
    });
  });

  // runden_strafpunkte / tuerme_punkte: Listen in voller Länge mit 0 vorbelegen,
  // damit auch ein unberührtes Formular die vom Server verlangte Form liefert.
  const rundenSoll = wl?.typ === "runden_strafpunkte" ? (wl.runden ?? 3) : null;
  const rundenInitNoetig =
    !readOnly && rundenSoll !== null && parseRunden(rohdaten).length !== rundenSoll;

  const tuermeSoll = wl?.typ === "tuerme_punkte" && wl.tuerme ? wl.tuerme.length : null;
  const tuermeInitNoetig =
    !readOnly && tuermeSoll !== null && parseTuerme(rohdaten).length !== tuermeSoll;

  useEffect(() => {
    if (rundenInitNoetig && rundenSoll !== null) {
      onChange({ ...rohdaten, runden: padRunden(parseRunden(rohdaten), rundenSoll) });
    } else if (tuermeInitNoetig && tuermeSoll !== null) {
      onChange({ ...rohdaten, tuerme: padTuerme(parseTuerme(rohdaten), tuermeSoll) });
    }
  });

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

  // punkte_duell ohne Team-Kontext (z. B. Korrektur-Modal): Ist genau ein
  // Team-Feld gesetzt, nur dieses zeigen — sonst könnte ein Wert im anderen
  // Feld die Erstes-gesetztes-Feld-Regel der Berechnung verfälschen.
  const duellFelder = wl.typ === "punkte_duell" ? (wl.eingabefelder ?? []) : [];
  const gesetzteDuellFelder = duellFelder.filter((f) => rohdaten[f.name] !== undefined);
  const einzigesDuellFeld =
    isDuellTeamA === undefined && gesetzteDuellFelder.length === 1
      ? gesetzteDuellFelder[0]
      : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      {label && (
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
      )}

      {/* Eingabefelder */}
      {wl.eingabefelder?.map((f) => {
        // Für Duell: nur das relevante Feld zeigen
        if (wl.typ === "punkte_duell") {
          if (isDuellTeamA !== undefined) {
            const felder = wl.eingabefelder ?? [];
            const idx = isDuellTeamA ? 0 : 1;
            if (felder.indexOf(f) !== idx) return null;
          } else if (einzigesDuellFeld !== null && f.name !== einzigesDuellFeld.name) {
            return null;
          }
        }
        return (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label className={labelClass}>{f.label ?? f.name}</label>
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

      {/* Kleinbegegnungen (Cornhole) — per-Team-Sicht: eigene vs. gegnerische Punkte */}
      {wl.typ === "duell_kleinbegegnungen" && (
        <KleinbegegnungenEditor
          kleinbegegnungen={parseKleinbegegnungen(rohdaten)}
          onChange={(next) => update("kleinbegegnungen", next)}
          readOnly={readOnly}
          labelEigene="Eigene"
          labelGegner="Gegner"
        />
      )}

      {/* Runden + Strafpunkte (ChaosQuadrant) */}
      {wl.typ === "runden_strafpunkte" && (
        <RundenEditor
          anzahlRunden={wl.runden ?? 3}
          runden={parseRunden(rohdaten)}
          onChange={(next) => update("runden", next)}
          readOnly={readOnly}
        />
      )}

      {/* Türme (Robert Huber Radio) */}
      {wl.typ === "tuerme_punkte" && wl.tuerme && (
        <TuermeEditor
          tuerme={wl.tuerme}
          werte={parseTuerme(rohdaten)}
          onChange={(next) => update("tuerme", next)}
          readOnly={readOnly}
        />
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

      {/* Zeit-Eingabe als mm:ss (wenn kein Eingabefeld definiert aber Typ=zeit) */}
      {wl.typ === "zeit" && !wl.eingabefelder?.length && (
        <ZeitEditor
          rohdaten={rohdaten}
          onUpdate={(key, value) => update(key, value)}
          maxSekunden={wl.maxSekunden}
          readOnly={readOnly}
        />
      )}
    </section>
  );
}
