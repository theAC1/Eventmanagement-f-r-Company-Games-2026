"use client";

import Link from "next/link";

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
  lastUpdate: Date | null;
  fetchError: string | null;
  onRetry: () => void;
};

export function UebersichtTab({
  rangliste,
  ergebnisse,
  games,
  lastUpdate,
  fetchError,
  onRetry,
}: UebersichtTabProps) {
  const totalGames = games.length;
  const totalTeams = rangliste.length;
  const totalSlots = totalGames * totalTeams;
  const doneSlots = ergebnisse.length;
  const progressPct =
    totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;

  // Ergebnisse pro Game
  const ergebnisseProGame = new Map<string, GameErgebnis[]>();
  for (const e of ergebnisse) {
    const list = ergebnisseProGame.get(e.game.id) ?? [];
    list.push(e);
    ergebnisseProGame.set(e.game.id, list);
  }

  // Letztes Ergebnis (fuer Live-Feed)
  const recentErgebnisse = [...ergebnisse]
    .filter((e) => e.eingetragenUm)
    .sort(
      (a, b) =>
        new Date(b.eingetragenUm!).getTime() -
        new Date(a.eingetragenUm!).getTime(),
    )
    .slice(0, 8);

  // Live-Partien (LAUFEND)
  const laufendePartien = ergebnisse.filter((e) => e.status === "LAUFEND");

  return (
    <div className="space-y-6">
      {/* Header mit Fortschritt + Export */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-zinc-500">
              {doneSlots}/{totalSlots} Ergebnisse ({progressPct}%)
            </p>
            <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {lastUpdate && (
              <span className="text-xs text-zinc-600">
                {lastUpdate.toLocaleTimeString("de-CH")} &middot; Auto 5s
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="px-3 py-2 border border-zinc-700 text-sm rounded-lg hover:border-zinc-500 transition flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => window.open("/api/export/rangliste", "_blank")}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 rounded-t-lg transition"
              >
                Rangliste CSV
              </button>
              <button
                onClick={() => window.open("/api/export/ergebnisse", "_blank")}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition"
              >
                Ergebnisse CSV
              </button>
              <button
                onClick={() => window.open("/api/export/teams", "_blank")}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition"
              >
                Teams CSV
              </button>
              <div className="border-t border-zinc-700" />
              <button
                onClick={() =>
                  window.open("/admin/gameday/print", "_blank")
                }
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 rounded-b-lg transition text-zinc-400"
              >
                Druckansicht
              </button>
            </div>
          </div>
          <Link
            href="/scoreboard"
            target="_blank"
            className="px-3 py-2 border border-zinc-700 text-sm rounded-lg hover:border-zinc-500 transition"
          >
            Scoreboard
          </Link>
        </div>
      </div>

      {fetchError && (
        <div className="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg text-xs text-red-300 flex items-center justify-between">
          <span>
            {fetchError} — Daten könnten veraltet sein. Nächster Versuch in 5s.
          </span>
          <button
            onClick={onRetry}
            className="ml-3 px-2 py-1 border border-red-800 rounded text-xs hover:border-red-600 transition"
          >
            Jetzt
          </button>
        </div>
      )}

      {/* Live-Partien */}
      {laufendePartien.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Live-Partien
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {laufendePartien.map((e) => {
              const startedAt = e.eingetragenUm
                ? new Date(e.eingetragenUm)
                : null;
              const minutenSeit = startedAt
                ? Math.round(
                    (Date.now() - startedAt.getTime()) / 60000,
                  )
                : null;

              return (
                <div
                  key={e.id}
                  className="border border-blue-900/50 bg-blue-950/20 rounded-lg p-3 space-y-1"
                >
                  <p className="text-xs text-blue-400 font-medium">
                    {e.game.name}
                  </p>
                  <p className="text-sm text-zinc-200">
                    {e.team.name}
                  </p>
                  {minutenSeit !== null && (
                    <p className="text-[11px] text-zinc-500">
                      Läuft seit {minutenSeit} min
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Stationen-Status */}
        <div className="col-span-2 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Stationen
          </h2>
          <div className="space-y-1.5">
            {games.map((g) => {
              const erg = ergebnisseProGame.get(g.id) ?? [];
              const done = erg.length;
              const pct =
                totalTeams > 0 ? Math.round((done / totalTeams) * 100) : 0;
              const isDuell = g.modus === "DUELL";
              const lastResult = erg
                .filter((e) => e.eingetragenUm)
                .sort(
                  (a, b) =>
                    new Date(b.eingetragenUm!).getTime() -
                    new Date(a.eingetragenUm!).getTime(),
                )[0];

              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900/40"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      pct === 100
                        ? "bg-emerald-400"
                        : pct > 0
                          ? "bg-amber-400"
                          : "bg-zinc-600"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium flex-1 ${isDuell ? "text-blue-300" : ""}`}
                  >
                    {g.name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {done}/{totalTeams}
                  </span>
                  <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {lastResult && (
                    <span className="text-[10px] text-zinc-600 w-24 text-right truncate">
                      {lastResult.team.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rangliste + Live-Feed */}
        <div className="space-y-4">
          <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Top 5
            </h2>
            {rangliste.slice(0, 5).map((r) => (
              <div
                key={r.teamId}
                className="flex items-center justify-between text-sm px-1 py-1"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 text-right font-bold tabular-nums ${r.gesamtRang <= 3 ? "text-amber-400" : "text-zinc-500"}`}
                  >
                    {r.gesamtRang}
                  </span>
                  <span className="truncate max-w-[100px]">
                    {r.teamName}
                  </span>
                </div>
                <span className="font-bold tabular-nums">
                  {r.rangPunkteSumme}
                </span>
              </div>
            ))}
          </div>

          {/* Live-Feed */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Live-Feed
            </h2>
            {recentErgebnisse.length === 0 ? (
              <p className="text-xs text-zinc-600">Noch keine Ergebnisse</p>
            ) : (
              <div className="space-y-1.5">
                {recentErgebnisse.map((e) => (
                  <div key={e.id} className="text-[11px] text-zinc-400">
                    <span
                      className={
                        e.rangImGame === 1 ? "text-amber-400" : ""
                      }
                    >
                      #{e.rangImGame}
                    </span>{" "}
                    <span className="text-zinc-300">{e.team.name}</span>
                    <span className="text-zinc-600"> @ </span>
                    {e.game.name}
                    {e.eingetragenUm && (
                      <span className="text-zinc-700 ml-1">
                        {new Date(e.eingetragenUm).toLocaleTimeString(
                          "de-CH",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
