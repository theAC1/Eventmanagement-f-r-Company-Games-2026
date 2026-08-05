"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type GameErgebnis = {
  id: string;
  gamePunkte: number | null;
  rangImGame: number | null;
  status: string;
  eingetragenUm: string | null;
  game: { id: string; name: string; slug: string };
  team: { id: string; name: string; nummer: number };
};

type GameInfo = {
  id: string;
  name: string;
  slug: string;
  modus: string;
  status: string;
};

type EinsatzplanSlot = {
  id: string;
  runde: number;
  startZeit: string;
  endZeit: string;
  gameId: string | null;
  game: { id: string; name: string; slug: string } | null;
  teams: { team: { id: string; name: string; nummer: number } }[];
};

type EinsatzplanConfig = {
  id: string;
  name: string;
  startZeit: string;
  endZeit: string;
};

type ZeitachseTabProps = {
  games: GameInfo[];
  ergebnisse: GameErgebnis[];
  onInspectGame: (gameId: string) => void;
};

const DONE_STATUS = new Set(["EINGETRAGEN", "VERIFIZIERT", "KORRIGIERT"]);

type CellState = "done" | "live" | "open" | "none";

/** Zellfarben themesicher aus Tokens gemischt (statt hartcodierter rgba-Dark-Werte). */
const CELL_STYLE: Record<Exclude<CellState, "none">, React.CSSProperties> = {
  done: {
    background: "color-mix(in srgb, var(--done) 55%, transparent)",
    border: "1px solid color-mix(in srgb, var(--done) 25%, transparent)",
  },
  live: {
    background: "color-mix(in srgb, var(--warn) 75%, transparent)",
    border: "1px solid color-mix(in srgb, var(--warn) 40%, transparent)",
  },
  open: {
    background: "var(--cell-empty)",
    border: "1px solid var(--cell-empty-border)",
  },
};

function minutesSince(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000));
}

function LegendChip({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={style} />
      <span className="text-[11px] text-ink-3">{label}</span>
    </span>
  );
}

export function ZeitachseTab({ games, ergebnisse, onInspectGame }: ZeitachseTabProps) {
  const [slots, setSlots] = useState<EinsatzplanSlot[]>([]);
  const [config, setConfig] = useState<EinsatzplanConfig | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/einsatzplan")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setConfig(json.config ?? null);
        setSlots(Array.isArray(json.slots) ? json.slots : []);
        setPlanError(null);
        setPlanLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setPlanError(
          `Zeitplan konnte nicht geladen werden: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`,
        );
        setPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ergebnis-Lookup pro Game+Team
  const ergebnisMap = useMemo(() => {
    const map = new Map<string, GameErgebnis>();
    for (const e of ergebnisse) {
      map.set(`${e.game.id}_${e.team.id}`, e);
    }
    return map;
  }, [ergebnisse]);

  const erfasst = ergebnisse.filter((e) => DONE_STATUS.has(e.status));
  const laufendePartien = ergebnisse.filter((e) => e.status === "LAUFEND");

  // Spalten = Runden des Zeitplans
  const runden = useMemo(() => {
    const set = new Map<number, { runde: number; startZeit: string; endZeit: string }>();
    for (const s of slots) {
      if (!set.has(s.runde)) {
        set.set(s.runde, { runde: s.runde, startZeit: s.startZeit, endZeit: s.endZeit });
      }
    }
    return [...set.values()].sort((a, b) => a.runde - b.runde);
  }, [slots]);

  // Aktuelle Runde anhand der Uhrzeit (HH:MM-Vergleich)
  const nowHHMM = new Date().toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const aktuelleRunde =
    runden.find((r) => r.startZeit <= nowHHMM && nowHHMM < r.endZeit) ?? null;

  const slotFor = (gameId: string, runde: number): EinsatzplanSlot | undefined =>
    slots.find((s) => s.gameId === gameId && s.runde === runde);

  const cellState = (slot: EinsatzplanSlot | undefined): CellState => {
    if (!slot || slot.teams.length === 0) return "none";
    const ergs = slot.teams.map((t) =>
      ergebnisMap.get(`${slot.gameId}_${t.team.id}`),
    );
    if (ergs.every((e) => e && DONE_STATUS.has(e.status))) return "done";
    if (ergs.some((e) => e?.status === "LAUFEND")) return "live";
    return "open";
  };

  // "Was jetzt fehlt": Partien der aktuellen Runde, die noch nicht vollständig erfasst sind
  const fehlendePartien = !aktuelleRunde
    ? []
    : slots
        .filter(
          (s) => s.runde === aktuelleRunde.runde && s.gameId && s.teams.length > 0,
        )
        .map((s) => {
          const state = cellState(s);
          const laufend = s.teams
            .map((t) => ergebnisMap.get(`${s.gameId}_${t.team.id}`))
            .find((e) => e?.status === "LAUFEND");
          return { slot: s, state, laufend };
        })
        .filter((p) => p.state === "open" || p.state === "live");

  const hasRaster = runden.length > 0 && games.length > 0;

  return (
    <div className="flex flex-col">
      {/* Kopfzeile mit Legende */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-1.5 pt-3.5 sm:px-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-ink">
            {config
              ? aktuelleRunde
                ? `Slot ${aktuelleRunde.runde} von ${runden.length} · ${aktuelleRunde.startZeit} – ${aktuelleRunde.endZeit}`
                : `${config.name} · ${runden.length} Slots`
              : "Zeitachse"}
          </span>
          <span className="text-xs text-ink-3">
            <span className="tnum">{erfasst.length}</span> Ergebnisse erfasst ·{" "}
            <span className="tnum">{laufendePartien.length}</span> laufen gerade
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          <LegendChip style={CELL_STYLE.done} label="erfasst" />
          <LegendChip style={CELL_STYLE.live} label="läuft" />
          <LegendChip style={CELL_STYLE.open} label="offen" />
        </div>
      </div>

      {/* Raster */}
      {planLoading ? (
        <p className="border-b border-line px-4 py-6 text-sm text-ink-3 sm:px-[22px]">
          Lade Zeitplan…
        </p>
      ) : planError ? (
        <p className="border-b border-line px-4 py-6 text-sm text-hot-tint sm:px-[22px]">
          {planError}
        </p>
      ) : !hasRaster ? (
        <p className="border-b border-line px-4 py-6 text-sm text-ink-3 sm:px-[22px]">
          Kein Zeitplan hinterlegt — das Slot-Raster ist nicht verfügbar.
        </p>
      ) : (
        <div className="overflow-x-auto border-b border-line px-4 pb-3.5 pt-2.5 sm:px-[22px]">
          <div className="min-w-[640px]">
            <div
              className="grid gap-1 pb-2"
              style={{
                gridTemplateColumns: `200px repeat(${runden.length}, 1fr)`,
              }}
            >
              <span />
              {runden.map((r) => (
                <span
                  key={r.runde}
                  className="tnum text-center text-[10px]"
                  style={{
                    color:
                      aktuelleRunde?.runde === r.runde
                        ? "var(--warn)"
                        : "var(--label)",
                  }}
                  title={`${r.startZeit} – ${r.endZeit}`}
                >
                  {r.runde}
                </span>
              ))}
            </div>
            {games.map((g) => (
              <div
                key={g.id}
                className="mb-[3px] grid items-center gap-1"
                style={{
                  gridTemplateColumns: `200px repeat(${runden.length}, 1fr)`,
                }}
              >
                <span className="truncate pr-2.5 text-xs text-ink-2">{g.name}</span>
                {runden.map((r) => {
                  const slot = slotFor(g.id, r.runde);
                  const state = cellState(slot);
                  if (state === "none") {
                    return <span key={r.runde} className="h-[17px] rounded-[4px]" />;
                  }
                  const teamsLabel = slot!.teams
                    .map((t) => t.team.name)
                    .join(" vs. ");
                  return (
                    <span
                      key={r.runde}
                      className="h-[17px] rounded-[4px]"
                      style={CELL_STYLE[state]}
                      title={`${g.name} · Slot ${r.runde} · ${teamsLabel}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unterer Split: Was jetzt fehlt + Läuft gerade */}
      <div className="flex flex-col xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3 border-line px-4 py-[18px] sm:px-[22px] xl:border-r">
          <span className="cg-label">
            Was jetzt fehlt
            {fehlendePartien.length > 0 && (
              <span className="tnum"> · {fehlendePartien.length}</span>
            )}
          </span>

          {!aktuelleRunde ? (
            <p className="text-xs text-ink-3">
              {hasRaster
                ? "Aktuell läuft kein Slot des Zeitplans."
                : "Ohne Zeitplan kann keine Slot-Zuordnung angezeigt werden."}
            </p>
          ) : fehlendePartien.length === 0 ? (
            <p className="text-xs text-ink-3">
              Alle Partien des aktuellen Slots sind erfasst.
            </p>
          ) : (
            fehlendePartien.map(({ slot, state, laufend }) => {
              const teamsLabel = slot.teams.map((t) => t.team.name).join(" vs. ");
              return (
                <div
                  key={slot.id}
                  className="flex min-h-[58px] items-center gap-3.5 rounded-[10px] border border-line bg-surface px-3.5 py-2"
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{
                      background:
                        state === "live" ? "var(--warn)" : "var(--line-strong)",
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="truncate text-sm font-medium text-ink">
                      {teamsLabel}
                    </span>
                    <span className="truncate text-xs text-ink-3">
                      {slot.game?.name ?? "—"}
                    </span>
                  </div>
                  <span
                    className="tnum shrink-0 text-xs"
                    style={{
                      color: state === "live" ? "var(--warn)" : "var(--label)",
                    }}
                  >
                    {state === "live" && laufend?.eingetragenUm
                      ? `läuft ${minutesSince(laufend.eingetragenUm)} min`
                      : "offen"}
                  </span>
                  {slot.gameId && (
                    <Button
                      variant="primary"
                      className="shrink-0"
                      onClick={() => onInspectGame(slot.gameId!)}
                    >
                      Ansehen
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Läuft gerade */}
        <div className="flex shrink-0 flex-col gap-3 px-4 py-[18px] sm:px-5 xl:w-[340px]">
          <span className="cg-label">
            Läuft gerade
            {laufendePartien.length > 0 && (
              <span className="tnum"> · {laufendePartien.length}</span>
            )}
          </span>
          {laufendePartien.length === 0 ? (
            <p className="text-xs text-ink-3">Keine laufenden Partien</p>
          ) : (
            laufendePartien.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-warn">
                    {e.game.name}
                  </span>
                  {e.eingetragenUm && (
                    <span className="tnum shrink-0 text-base font-semibold text-ink">
                      {minutesSince(e.eingetragenUm)} min
                    </span>
                  )}
                </div>
                <span className="truncate text-sm text-ink">{e.team.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
