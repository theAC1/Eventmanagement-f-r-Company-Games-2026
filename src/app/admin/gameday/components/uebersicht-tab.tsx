"use client";

import { CaretRight, LockSimple } from "@phosphor-icons/react";
import { KpiBand, KpiCell } from "@/components/ui/kpi";
import { ModusChip } from "@/components/ui/pills";
import { ProgressBar, progressColor } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type RanglisteEntry = {
  teamId: string;
  teamName: string;
  rangPunkteSumme: number;
  gamesGespielt: number;
  gamesTotal: number;
  gesamtRang: number;
};

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

type UebersichtTabProps = {
  rangliste: RanglisteEntry[];
  ergebnisse: GameErgebnis[];
  games: GameInfo[];
  fetchError: string | null;
  onRetry: () => void;
};

const DONE_STATUS = new Set(["EINGETRAGEN", "VERIFIZIERT", "KORRIGIERT"]);

/** Rangfarben im Rangkampf: 1 amber, 2 hell, 3 bronze, 4 gedämpft. */
const RANG_COLORS = ["var(--warn)", "var(--ink-2)", "var(--bronze)", "var(--ink-3)"];
const RANG_BAR_COLORS = ["var(--warn)", "var(--ink-2)", "var(--bronze)", "var(--line-strong)"];

function formatZeit(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UebersichtTab({
  rangliste,
  ergebnisse,
  games,
  fetchError,
  onRetry,
}: UebersichtTabProps) {
  const totalGames = games.length;
  const totalTeams = rangliste.length;
  const totalSlots = totalGames * totalTeams;
  const erfasste = ergebnisse.filter((e) => DONE_STATUS.has(e.status));
  const doneSlots = erfasste.length;
  const offeneSlots = Math.max(0, totalSlots - doneSlots);
  const progressPct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;

  // Ergebnisse pro Game
  const ergebnisseProGame = new Map<string, GameErgebnis[]>();
  for (const e of ergebnisse) {
    const list = ergebnisseProGame.get(e.game.id) ?? [];
    list.push(e);
    ergebnisseProGame.set(e.game.id, list);
  }

  // Letzte Ergebnisse (Eingänge-Feed)
  const recentErgebnisse = [...erfasste]
    .filter((e) => e.eingetragenUm)
    .sort(
      (a, b) =>
        new Date(b.eingetragenUm!).getTime() - new Date(a.eingetragenUm!).getTime(),
    )
    .slice(0, 7);

  // Live-Partien (LAUFEND)
  const laufendePartien = ergebnisse.filter((e) => e.status === "LAUFEND");

  // Stationen fertig: alle Teams erfasst
  const stationenFertig = games.filter((g) => {
    const done = (ergebnisseProGame.get(g.id) ?? []).filter((e) =>
      DONE_STATUS.has(e.status),
    ).length;
    return totalTeams > 0 && done >= totalTeams;
  }).length;

  const top4 = rangliste.slice(0, 4);
  const leaderPunkte = top4[0]?.rangPunkteSumme ?? 0;

  return (
    <div className="flex flex-col">
      {fetchError && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-[10px] border border-[var(--hot-border)] bg-hot-dim px-3.5 py-2.5 sm:mx-[22px]">
          <span className="text-xs text-hot-tint">
            {fetchError} — Daten könnten veraltet sein. Nächster Versuch in 5s.
          </span>
          <Button variant="danger-ghost" onClick={onRetry} className="shrink-0">
            Jetzt
          </Button>
        </div>
      )}

      {/* KPI-Band */}
      <KpiBand columns="repeat(auto-fit, minmax(160px, 1fr))" className="mt-0">
        <KpiCell
          label="Ergebnisse"
          value={doneSlots}
          denominator={`/ ${totalSlots}`}
          bar={{ pct: progressPct, color: "var(--done)" }}
        />
        <KpiCell
          label="Offen"
          value={offeneSlots}
          unit="Slots"
          valueColor={offeneSlots > 0 ? "var(--warn)" : "var(--ink)"}
          note={
            laufendePartien.length > 0
              ? `${laufendePartien.length} laufen gerade`
              : undefined
          }
        />
        <KpiCell
          label="Laufende Partien"
          value={laufendePartien.length}
          valueColor={laufendePartien.length > 0 ? "var(--warn)" : "var(--ink)"}
        />
        <KpiCell
          label="Stationen fertig"
          value={stationenFertig}
          denominator={`/ ${totalGames}`}
          valueColor={
            totalGames > 0 && stationenFertig === totalGames
              ? "var(--done)"
              : "var(--ink)"
          }
          last
        />
      </KpiBand>

      {/* Split: Stationen-Tabelle + rechte Leiste */}
      <div className="flex flex-col xl:flex-row">
        {/* Stationen */}
        <div className="min-w-0 flex-1 border-line xl:border-r">
          <div className="hidden gap-3.5 border-b border-line bg-sunken px-[22px] py-[11px] xl:grid xl:grid-cols-[36px_minmax(0,1fr)_168px_200px_150px_34px]">
            <span className="cg-label">NR</span>
            <span className="cg-label">Station</span>
            <span className="cg-label">Fortschritt</span>
            <span className="cg-label">Läuft jetzt</span>
            <span className="cg-label">Zuletzt</span>
            <span />
          </div>

          {games.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-3 sm:px-[22px]">
              Keine aktiven Stationen
            </p>
          )}

          {games.map((g, idx) => {
            const erg = ergebnisseProGame.get(g.id) ?? [];
            const done = erg.filter((e) => DONE_STATUS.has(e.status)).length;
            const pct = totalTeams > 0 ? Math.round((done / totalTeams) * 100) : 0;
            const liveHere = laufendePartien.filter((e) => e.game.id === g.id);
            const isLive = liveHere.length > 0;
            const liveText = isLive
              ? liveHere.map((e) => e.team.name).join(", ")
              : null;
            const lastResult = erg
              .filter((e) => e.eingetragenUm && DONE_STATUS.has(e.status))
              .sort(
                (a, b) =>
                  new Date(b.eingetragenUm!).getTime() -
                  new Date(a.eingetragenUm!).getTime(),
              )[0];

            return (
              <div
                key={g.id}
                className={`flex flex-col gap-2 border-b border-line-soft px-4 py-3 transition-colors duration-150 hover:bg-sunken/60 sm:px-[22px] xl:grid xl:h-[62px] xl:grid-cols-[36px_minmax(0,1fr)_168px_200px_150px_34px] xl:items-center xl:gap-3.5 xl:py-0 ${
                  isLive ? "bg-warn-row" : ""
                }`}
              >
                <span className="tnum hidden text-xs font-semibold text-ink-3 xl:block">
                  {idx + 1}
                </span>

                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium text-ink">
                    <span className="tnum mr-2 text-xs font-semibold text-ink-3 xl:hidden">
                      {idx + 1}
                    </span>
                    {g.name}
                  </span>
                  <div className="flex items-center gap-[7px]">
                    <ModusChip modus={g.modus} size="table" />
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <ProgressBar
                    pct={pct}
                    color={progressColor({ done, total: totalTeams, live: isLive })}
                    height={6}
                    className="flex-1"
                  />
                  <span className="tnum w-11 text-right text-xs text-ink-3">
                    {done}/{totalTeams}
                  </span>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: isLive ? "var(--warn)" : "transparent" }}
                  />
                  {liveText ? (
                    <span className="truncate text-[13px] text-ink">{liveText}</span>
                  ) : (
                    <span className="text-[13px] text-disabled">—</span>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-0.5">
                  {lastResult ? (
                    <>
                      <span className="truncate text-xs text-ink-3">
                        {lastResult.team.name}
                      </span>
                      <span className="tnum text-[11px] text-label">
                        {formatZeit(lastResult.eingetragenUm!)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-disabled">—</span>
                  )}
                </div>

                <CaretRight
                  size={15}
                  weight="bold"
                  className="hidden text-faint xl:block"
                />
              </div>
            );
          })}
        </div>

        {/* Rechte Leiste */}
        <div className="flex shrink-0 flex-col xl:w-[340px]">
          {/* Rangkampf */}
          <div className="flex flex-col gap-3.5 border-b border-line px-4 py-[18px] sm:px-5">
            <div className="flex items-center justify-between">
              <span className="cg-label">Rangkampf</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-warn">
                <LockSimple size={12} weight="bold" />
                NUR ORGA
              </span>
            </div>

            {top4.length === 0 ? (
              <p className="text-xs text-ink-3">Noch keine Rangliste</p>
            ) : (
              top4.map((r, idx) => {
                const delta =
                  idx === 0 ? "" : `−${leaderPunkte - r.rangPunkteSumme}`;
                const barW =
                  leaderPunkte > 0
                    ? Math.round((r.rangPunkteSumme / leaderPunkte) * 100)
                    : 0;
                return (
                  <div key={r.teamId} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="tnum w-4 text-[15px] font-bold"
                        style={{ color: RANG_COLORS[idx] ?? "var(--ink-3)" }}
                      >
                        {r.gesamtRang}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {r.teamName}
                      </span>
                      <span className="tnum text-base font-semibold text-ink">
                        {r.rangPunkteSumme}
                      </span>
                      <span className="tnum w-8 text-right text-[11px] text-ink-3">
                        {delta}
                      </span>
                    </div>
                    <ProgressBar
                      pct={barW}
                      color={RANG_BAR_COLORS[idx] ?? "var(--line-strong)"}
                      height={4}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Eingänge */}
          <div className="flex flex-1 flex-col gap-3 px-4 py-[18px] sm:px-5">
            <span className="cg-label">Eingänge</span>
            {recentErgebnisse.length === 0 ? (
              <p className="text-xs text-ink-3">Noch keine Ergebnisse</p>
            ) : (
              recentErgebnisse.map((e) => (
                <div key={e.id} className="flex items-center gap-2.5">
                  <span className="tnum w-[38px] shrink-0 text-[11px] text-label">
                    {e.eingetragenUm ? formatZeit(e.eingetragenUm) : "–"}
                  </span>
                  <span
                    className="tnum w-5 shrink-0 text-[11px] font-bold"
                    style={{
                      color: e.rangImGame === 1 ? "var(--warn)" : "var(--ink-3)",
                    }}
                  >
                    {e.rangImGame != null ? `#${e.rangImGame}` : "–"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-2">
                    {e.team.name}
                  </span>
                  <span className="max-w-[110px] truncate text-[11px] text-ink-3">
                    {e.game.name}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
