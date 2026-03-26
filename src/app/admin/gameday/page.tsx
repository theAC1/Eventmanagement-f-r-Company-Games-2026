"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RanglisteEntry = {
  teamId: string; teamName: string; rangPunkteSumme: number;
  gamesGespielt: number; gamesTotal: number; gesamtRang: number;
};

type GameErgebnis = {
  id: string; gamePunkte: number | null; rangImGame: number | null;
  status: string; eingetragenUm: string | null;
  game: { id: string; name: string; slug: string };
  team: { id: string; name: string; nummer: number };
};

type GameInfo = {
  id: string; name: string; slug: string; modus: string; status: string;
};

export default function GamedayDashboard() {
  const [rangliste, setRangliste] = useState<RanglisteEntry[]>([]);
  const [ergebnisse, setErgebnisse] = useState<GameErgebnis[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = () => {
    Promise.all([
      fetch("/api/rangliste").then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch("/api/ergebnisse").then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch("/api/games").then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ]).then(([rang, erg, g]) => {
      setRangliste(rang.rangliste ?? []);
      setErgebnisse(Array.isArray(erg) ? erg : []);
      setGames((Array.isArray(g) ? g : []).filter((x: GameInfo) => x.status === "BEREIT" || x.status === "AKTIV"));
      setLastUpdate(new Date());
      setFetchError(null);
      setLoading(false);
    }).catch((err) => {
      setFetchError(`Verbindung fehlgeschlagen: ${err.message}`);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Ergebnisse pro Game
  const ergebnisseProGame = new Map<string, GameErgebnis[]>();
  for (const e of ergebnisse) {
    const list = ergebnisseProGame.get(e.game.id) ?? [];
    list.push(e);
    ergebnisseProGame.set(e.game.id, list);
  }

  // Letztes Ergebnis (für Live-Feed)
  const recentErgebnisse = [...ergebnisse]
    .filter(e => e.eingetragenUm)
    .sort((a, b) => new Date(b.eingetragenUm!).getTime() - new Date(a.eingetragenUm!).getTime())
    .slice(0, 8);

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade Dashboard...</div>;

  if (fetchError && rangliste.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400 text-sm">{fetchError}</p>
        <button onClick={loadData} className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition">
          Erneut versuchen
        </button>
      </div>
    );
  }

  const totalGames = games.length;
  const totalTeams = rangliste.length;
  const totalSlots = totalGames * totalTeams;
  const doneSlots = ergebnisse.length;
  const progressPct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gameday Live</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-zinc-500">
              {doneSlots}/{totalSlots} Ergebnisse ({progressPct}%)
            </p>
            <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            {lastUpdate && (
              <span className="text-xs text-zinc-600">
                {lastUpdate.toLocaleTimeString("de-CH")} &middot; Auto 5s
              </span>
            )}
          </div>
        </div>
        <Link href="/scoreboard" target="_blank"
          className="px-4 py-2 border border-zinc-700 text-sm rounded-lg hover:border-zinc-500 transition">
          Scoreboard
        </Link>
      </div>

      {fetchError && (
        <div className="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg text-xs text-red-300">
          {fetchError} — Daten könnten veraltet sein. Nächster Versuch in 5s.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Stationen-Status */}
        <div className="col-span-2 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stationen</h2>
          <div className="space-y-1.5">
            {games.map(g => {
              const erg = ergebnisseProGame.get(g.id) ?? [];
              const done = erg.length;
              const pct = totalTeams > 0 ? Math.round((done / totalTeams) * 100) : 0;
              const isDuell = g.modus === "DUELL";
              const lastResult = erg.filter(e => e.eingetragenUm).sort((a, b) =>
                new Date(b.eingetragenUm!).getTime() - new Date(a.eingetragenUm!).getTime()
              )[0];

              return (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900/40">
                  <div className={`w-2 h-2 rounded-full ${
                    pct === 100 ? "bg-emerald-400" : pct > 0 ? "bg-amber-400" : "bg-zinc-600"
                  }`} />
                  <span className={`text-sm font-medium flex-1 ${isDuell ? "text-blue-300" : ""}`}>
                    {g.name}
                  </span>
                  <span className="text-xs text-zinc-500">{done}/{totalTeams}</span>
                  <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${pct}%` }} />
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
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Top 5</h2>
            {rangliste.slice(0, 5).map(r => (
              <div key={r.teamId} className="flex items-center justify-between text-sm px-1 py-1">
                <div className="flex items-center gap-2">
                  <span className={`w-5 text-right font-bold tabular-nums ${r.gesamtRang <= 3 ? "text-amber-400" : "text-zinc-500"}`}>
                    {r.gesamtRang}
                  </span>
                  <span className="truncate max-w-[100px]">{r.teamName}</span>
                </div>
                <span className="font-bold tabular-nums">{r.rangPunkteSumme}</span>
              </div>
            ))}
          </div>

          {/* Live-Feed */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Live-Feed</h2>
            {recentErgebnisse.length === 0 ? (
              <p className="text-xs text-zinc-600">Noch keine Ergebnisse</p>
            ) : (
              <div className="space-y-1.5">
                {recentErgebnisse.map(e => (
                  <div key={e.id} className="text-[11px] text-zinc-400">
                    <span className={e.rangImGame === 1 ? "text-amber-400" : ""}>
                      #{e.rangImGame}
                    </span>{" "}
                    <span className="text-zinc-300">{e.team.name}</span>
                    <span className="text-zinc-600"> @ </span>
                    {e.game.name}
                    {e.eingetragenUm && (
                      <span className="text-zinc-700 ml-1">
                        {new Date(e.eingetragenUm).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
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
