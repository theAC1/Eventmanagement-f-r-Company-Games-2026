"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Game = {
  id: string;
  name: string;
  slug: string;
  status: string;
  modus: string;
  playtimeMin: number;
};

export default function RefereePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then(setGames)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Games...
      </div>
    );
  }

  const activeGames = games.filter(
    (g) => g.status === "BEREIT" || g.status === "AKTIV"
  );
  const otherGames = games.filter(
    (g) => g.status !== "BEREIT" && g.status !== "AKTIV"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stationen</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Wähle deine Station um Regeln und Wertung zu sehen
        </p>
      </div>

      {activeGames.length > 0 && (
        <div className="space-y-2">
          {activeGames.map((game) => (
            <Link
              key={game.id}
              href={`/referee/${game.slug}`}
              className="flex items-center justify-between p-4 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:bg-zinc-900/40 transition"
            >
              <div>
                <span className="font-medium">{game.name}</span>
                <span className="ml-3 text-xs text-zinc-500">
                  {game.modus === "DUELL" ? "Duell" : "Solo"} &middot;{" "}
                  {game.playtimeMin} min
                </span>
              </div>
              <span className="text-zinc-600">&rarr;</span>
            </Link>
          ))}
        </div>
      )}

      {otherGames.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">
            Noch nicht aktiv
          </p>
          {otherGames.map((game) => (
            <Link
              key={game.id}
              href={`/referee/${game.slug}`}
              className="flex items-center justify-between p-4 border border-zinc-800/50 rounded-lg text-zinc-500 hover:border-zinc-700 transition"
            >
              <span>{game.name}</span>
              <span className="text-zinc-700">&rarr;</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
