"use client";

import { useEffect, useState } from "react";
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

export default function GamedayDashboard() {
  const [rangliste, setRangliste] = useState<RanglisteEntry[]>([]);
  const [ergebnisse, setErgebnisse] = useState<GameErgebnis[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = () => {
    Promise.all([
      fetch("/api/rangliste").then((r) => r.json()),
      fetch("/api/ergebnisse").then((r) => r.json()),
    ]).then(([rang, erg]) => {
      setRangliste(rang.rangliste ?? []);
      setErgebnisse(erg);
      setLastUpdate(new Date());
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Ergebnisse pro Game gruppieren
  const gameGroups = new Map<string, { name: string; slug: string; ergebnisse: GameErgebnis[] }>();
  for (const e of ergebnisse) {
    const group = gameGroups.get(e.game.id) ?? { name: e.game.name, slug: e.game.slug, ergebnisse: [] };
    group.ergebnisse.push(e);
    gameGroups.set(e.game.id, group);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-500">Lade Dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gameday Live</h1>
          {lastUpdate && (
            <p className="text-xs text-zinc-500 mt-1">
              Letztes Update: {lastUpdate.toLocaleTimeString("de-CH")} &middot; Auto-Refresh 10s
            </p>
          )}
        </div>
        <Link
          href="/scoreboard"
          className="px-4 py-2 border border-zinc-700 text-sm rounded-lg hover:border-zinc-500 transition"
        >
          Scoreboard
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Live-Rangliste */}
        <section className="border border-zinc-800 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Live-Rangliste
          </h2>
          {rangliste.length === 0 ? (
            <p className="text-sm text-zinc-600">Noch keine Ergebnisse</p>
          ) : (
            <div className="space-y-1">
              {rangliste.slice(0, 10).map((r) => (
                <div
                  key={r.teamId}
                  className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-zinc-900/40"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-right font-bold tabular-nums ${
                        r.gesamtRang <= 3 ? "text-amber-400" : "text-zinc-500"
                      }`}
                    >
                      {r.gesamtRang}
                    </span>
                    <span>{r.teamName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      {r.gamesGespielt}/{r.gamesTotal}
                    </span>
                    <span className="font-bold tabular-nums">
                      {r.rangPunkteSumme}
                    </span>
                  </div>
                </div>
              ))}
              {rangliste.length > 10 && (
                <Link
                  href="/scoreboard"
                  className="block text-center text-xs text-zinc-500 hover:text-white transition py-2"
                >
                  Alle {rangliste.length} Teams anzeigen
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Ergebnisse pro Game */}
        <section className="border border-zinc-800 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Ergebnisse pro Game
          </h2>
          {gameGroups.size === 0 ? (
            <p className="text-sm text-zinc-600">Noch keine Ergebnisse eingetragen</p>
          ) : (
            <div className="space-y-3">
              {Array.from(gameGroups.entries()).map(([gameId, group]) => (
                <div key={gameId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{group.name}</span>
                    <span className="text-xs text-zinc-500">
                      {group.ergebnisse.length} Ergebnisse
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.ergebnisse
                      .sort((a, b) => (a.rangImGame ?? 99) - (b.rangImGame ?? 99))
                      .slice(0, 5)
                      .map((e) => (
                        <span
                          key={e.id}
                          className={`text-xs px-2 py-0.5 rounded border ${
                            e.rangImGame === 1
                              ? "border-amber-700 text-amber-400"
                              : "border-zinc-800 text-zinc-400"
                          }`}
                        >
                          #{e.rangImGame} {e.team.name}
                        </span>
                      ))}
                    {group.ergebnisse.length > 5 && (
                      <span className="text-xs text-zinc-600 py-0.5">
                        +{group.ergebnisse.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
