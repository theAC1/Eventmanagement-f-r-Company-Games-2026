"use client";

/**
 * Erfassungs-Widgets der Live-Seite, ein Block pro Wertungstyp.
 * Hierher ausgelagert aus referee/[slug]/live/page.tsx.
 *
 * Der Aufrufer verwaltet den rohdatenMap-State; `onUpdate` muss ein
 * funktionales setState nutzen, damit auch zwei direkt aufeinander
 * folgende Updates (Kleinbegegnungen-Spiegelung) sicher sind.
 */

import {
  parseKleinbegegnungen,
  parseRunden,
  parseTuerme,
  spiegleKleinbegegnungen,
} from "@/lib/game-punkte-berechnung";
import type { KleinbegegnungRoh, Wertungslogik } from "@/lib/wertungslogik-types";
import { KleinbegegnungenEditor } from "./kleinbegegnungen-editor";
import { RundenEditor } from "./runden-editor";
import { ScoreCounter } from "./score-counter";
import { Stopwatch } from "./stopwatch";
import { TuermeEditor } from "./tuerme-editor";
import { ZeitEditor } from "./zeit-editor";
import { labelClass } from "./styles";

export type LiveErgebnis = {
  id: string;
  team: { name: string };
};

export type LiveErfassungProps = {
  wertungslogik: Wertungslogik;
  ergebnisse: LiveErgebnis[];
  rohdatenMap: Record<string, Record<string, unknown>>;
  isDuell: boolean;
  onUpdate: (ergebnisId: string, key: string, value: unknown) => void;
};

export function LiveErfassung({
  wertungslogik: wl,
  ergebnisse,
  rohdatenMap,
  isDuell,
  onUpdate,
}: LiveErfassungProps) {
  return (
    <div className="flex flex-col gap-3.5 px-[18px] py-[18px] lg:px-0">
      {/* PUNKTE_DUELL: ein Punktezähler pro Team */}
      {wl.typ === "punkte_duell" && isDuell && (
        <div className="flex flex-col gap-3.5">
          {ergebnisse.map((e, i) => {
            const felder = wl.eingabefelder ?? [];
            const fieldIdx = Math.min(i, felder.length - 1);
            const field = felder[fieldIdx];
            const rd = rohdatenMap[e.id] ?? {};
            const score = field ? Number(rd[field.name]) || 0 : 0;

            return (
              <ScoreCounter
                key={e.id}
                teamName={e.team.name}
                score={score}
                onChange={(val) => {
                  if (field) onUpdate(e.id, field.name, val);
                }}
              />
            );
          })}
        </div>
      )}

      {/* PUNKTE_DUELL: Solo-Variante — einzelner Zähler */}
      {wl.typ === "punkte_duell" && !isDuell && ergebnisse[0] && (() => {
        const e = ergebnisse[0];
        const field = (wl.eingabefelder ?? [])[0];
        const rd = rohdatenMap[e.id] ?? {};
        const score = field ? Number(rd[field.name]) || 0 : 0;

        return (
          <ScoreCounter
            teamName={e.team.name}
            score={score}
            onChange={(val) => {
              if (field) onUpdate(e.id, field.name, val);
            }}
          />
        );
      })()}

      {/* ZEIT: Stoppuhr + Strafen; mit maxSekunden zusätzlich mm:ss-Korrektur + DNF */}
      {wl.typ === "zeit" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        return (
          <div key={e.id} className="flex flex-col gap-3">
            {isDuell && <p className="text-sm font-medium text-ink-2">{e.team.name}</p>}
            <Stopwatch
              onTimeRecorded={(sek) => onUpdate(e.id, "zeit_sekunden", sek)}
              penalties={wl.strafen}
              rohdaten={rd}
              onPenalty={(key, val) => onUpdate(e.id, key, val)}
            />
            {wl.nicht_geschafft && wl.maxSekunden === undefined && (
              <div className="mt-0.5 flex gap-3">
                <button
                  onClick={() => onUpdate(e.id, "nicht_geschafft", false)}
                  className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                    rd.nicht_geschafft !== true
                      ? "border-[1.5px] border-done bg-done-dim font-semibold text-done-tint"
                      : "border border-line-strong font-medium text-ink-3"
                  }`}
                >
                  Geschafft
                </button>
                <button
                  onClick={() => onUpdate(e.id, "nicht_geschafft", true)}
                  className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                    rd.nicht_geschafft === true
                      ? "border-[1.5px] border-[var(--hot-border)] bg-hot-dim font-semibold text-hot-tint"
                      : "border border-line-strong font-medium text-ink-3"
                  }`}
                >
                  Nicht geschafft
                </button>
              </div>
            )}
            {wl.maxSekunden !== undefined && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
                <p className={labelClass}>Zeit anpassen</p>
                <ZeitEditor
                  rohdaten={rd}
                  onUpdate={(key, value) => onUpdate(e.id, key, value)}
                  maxSekunden={wl.maxSekunden}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* MAX_VALUE: grosses Zahlenfeld */}
      {wl.typ === "max_value" && ergebnisse.map((e) => {
        const field =
          wl.eingabefelder?.[0] ?? { name: wl.messung ?? "wert", label: wl.einheit ?? "Wert" };
        const rd = rohdatenMap[e.id] ?? {};

        return (
          <div key={e.id} className="flex flex-col gap-1.5">
            {isDuell && <p className="text-sm font-medium text-ink-2">{e.team.name}</p>}
            <label className="cg-label text-label">{field.label ?? field.name}</label>
            <input
              type="number"
              inputMode="decimal"
              value={(rd[field.name] as string) ?? ""}
              onChange={(ev) => onUpdate(e.id, field.name, Number(ev.target.value) || 0)}
              className="tnum w-full rounded-[9px] border border-line-strong bg-sunken px-4 py-4 text-center text-3xl text-ink placeholder:text-faint focus:border-action focus:outline-none"
              placeholder="0"
            />
          </div>
        );
      })}

      {/* FORMEL: ein Zahlenfeld pro Eingabefeld */}
      {wl.typ === "formel" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        return (
          <div key={e.id} className="flex flex-col gap-3">
            {isDuell && <p className="text-sm font-medium text-ink-2">{e.team.name}</p>}
            {wl.eingabefelder?.map((f) => (
              <div key={f.name} className="flex flex-col gap-1">
                <label className="cg-label text-label">{f.label ?? f.name}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={(rd[f.name] as string) ?? ""}
                  onChange={(ev) => onUpdate(e.id, f.name, Number(ev.target.value) || 0)}
                  className="tnum h-12 w-full rounded-[9px] border border-line-strong bg-sunken px-4 text-lg text-ink placeholder:text-faint focus:border-action focus:outline-none"
                />
              </div>
            ))}
          </div>
        );
      })}

      {/* SIEG_ZUEGE: Zahlenfelder aus den Eingabefeldern (0-initialisiert) */}
      {wl.typ === "sieg_zuege" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        const felder = wl.eingabefelder?.length
          ? wl.eingabefelder
          : [
              { name: "siege", typ: "number", label: "Gewonnene Partien" },
              { name: "zuege", typ: "number", label: "Züge in gewonnenen Partien (Summe)" },
            ];
        return (
          <div key={e.id} className="flex flex-col gap-3">
            {isDuell && <p className="text-sm font-medium text-ink-2">{e.team.name}</p>}
            {felder.map((f) => (
              <div key={f.name} className="flex flex-col gap-1">
                <label className="cg-label text-label">{f.label ?? f.name}</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={Number(rd[f.name] ?? 0)}
                  onChange={(ev) =>
                    onUpdate(e.id, f.name, Math.max(0, Number(ev.target.value) || 0))
                  }
                  className="tnum h-12 w-full rounded-[9px] border border-line-strong bg-sunken px-4 text-lg text-ink placeholder:text-faint focus:border-action focus:outline-none"
                />
              </div>
            ))}
          </div>
        );
      })}

      {/* DUELL_KLEINBEGEGNUNGEN: EIN gemeinsamer Editor, Team B gespiegelt */}
      {wl.typ === "duell_kleinbegegnungen" && ergebnisse.length >= 2 && (() => {
        const [erste, zweite] = ergebnisse;
        const liste = parseKleinbegegnungen(rohdatenMap[erste.id] ?? {});
        const uebernehmen = (next: KleinbegegnungRoh[]) => {
          onUpdate(erste.id, "kleinbegegnungen", next);
          onUpdate(zweite.id, "kleinbegegnungen", spiegleKleinbegegnungen(next));
        };
        return (
          <div className="rounded-[14px] border border-line bg-surface p-[18px]">
            <KleinbegegnungenEditor
              kleinbegegnungen={liste}
              onChange={uebernehmen}
              labelEigene={erste.team.name}
              labelGegner={zweite.team.name}
            />
          </div>
        );
      })()}

      {/* DUELL_KLEINBEGEGNUNGEN: Fallback bei nur einem geladenen Ergebnis */}
      {wl.typ === "duell_kleinbegegnungen" && ergebnisse.length === 1 && (
        <div className="rounded-[14px] border border-line bg-surface p-[18px]">
          <KleinbegegnungenEditor
            kleinbegegnungen={parseKleinbegegnungen(rohdatenMap[ergebnisse[0].id] ?? {})}
            onChange={(next) => onUpdate(ergebnisse[0].id, "kleinbegegnungen", next)}
            labelEigene="Eigene"
            labelGegner="Gegner"
          />
        </div>
      )}

      {/* RUNDEN_STRAFPUNKTE: pro Team ein Runden-Editor mit grossen Foul-Zählern */}
      {wl.typ === "runden_strafpunkte" && ergebnisse.map((e) => (
        <div key={e.id} className="flex flex-col gap-2.5">
          {isDuell && (
            <p className="text-[16px] font-semibold text-ink">{e.team.name}</p>
          )}
          <RundenEditor
            anzahlRunden={wl.runden ?? 3}
            runden={parseRunden(rohdatenMap[e.id] ?? {})}
            onChange={(next) => onUpdate(e.id, "runden", next)}
            variante="live"
          />
        </div>
      ))}

      {/* TUERME_PUNKTE: Türme-Editor mit Steppern, Badge und Gesamtstand */}
      {wl.typ === "tuerme_punkte" && wl.tuerme && ergebnisse.map((e) => (
        <div key={e.id} className="flex flex-col gap-2.5">
          {isDuell && <p className="text-sm font-medium text-ink-2">{e.team.name}</p>}
          <TuermeEditor
            tuerme={wl.tuerme ?? []}
            werte={parseTuerme(rohdatenMap[e.id] ?? {})}
            onChange={(next) => onUpdate(e.id, "tuerme", next)}
          />
        </div>
      ))}

      {/* MULTI_LEVEL: grosse Level-Buttons */}
      {wl.typ === "multi_level" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        return (
          <div key={e.id} className="flex flex-col gap-2">
            {isDuell && <p className="text-sm font-medium text-ink-2">{e.team.name}</p>}
            <label className="cg-label text-label">Schwierigkeit</label>
            <div className="grid grid-cols-2 gap-2.5">
              {wl.levels?.map((l) => (
                <button
                  key={l.name}
                  onClick={() => onUpdate(e.id, "level", l.name)}
                  className={`min-h-16 rounded-xl px-3 py-3 text-sm capitalize transition-colors duration-150 ${
                    rd.level === l.name
                      ? "bg-action font-semibold text-on-action"
                      : "border border-line-strong font-medium text-ink-2"
                  }`}
                >
                  {l.name}
                  <span className="tnum mt-0.5 block text-xs opacity-70">
                    {l.grundpunkte} Punkte
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* RISIKO_WAHL: Options-Buttons + Erfolg-Toggle */}
      {wl.typ === "risiko_wahl" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        return (
          <div key={e.id} className="flex flex-col gap-4">
            {isDuell && <p className="text-sm font-medium text-ink-2">{e.team.name}</p>}

            <div className="flex flex-col gap-2">
              <label className="cg-label text-label">Wahl</label>
              <div className="grid grid-cols-2 gap-2.5">
                {wl.optionen?.map((o) => (
                  <button
                    key={o.name}
                    onClick={() => onUpdate(e.id, "option", o.name)}
                    className={`min-h-16 rounded-xl px-3 py-3 text-sm transition-colors duration-150 ${
                      rd.option === o.name
                        ? "bg-action font-semibold text-on-action"
                        : "border border-line-strong font-medium text-ink-2"
                    }`}
                  >
                    {o.name}
                    <span className="tnum mt-0.5 block text-xs opacity-70">
                      {o.punkte_erfolg} P
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="cg-label text-label">Erfolg?</label>
              <div className="flex gap-3">
                <button
                  onClick={() => onUpdate(e.id, "erfolg", true)}
                  className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                    rd.erfolg === true
                      ? "border-[1.5px] border-done bg-done-dim font-semibold text-done-tint"
                      : "border border-line-strong font-medium text-ink-3"
                  }`}
                >
                  Ja
                </button>
                <button
                  onClick={() => onUpdate(e.id, "erfolg", false)}
                  className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                    rd.erfolg === false
                      ? "border-[1.5px] border-[var(--hot-border)] bg-hot-dim font-semibold text-hot-tint"
                      : "border border-line-strong font-medium text-ink-3"
                  }`}
                >
                  Nein
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
