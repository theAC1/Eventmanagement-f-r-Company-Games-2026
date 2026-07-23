"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Game = {
  id: string;
  name: string;
  slug: string;
  typ: "RETURNEE" | "NEU";
  status: "ENTWURF" | "BEREIT" | "AKTIV" | "ABGESCHLOSSEN";
  modus: "SOLO" | "DUELL";
  teamsProSlot: number;
  playtimeMin: number;
  helferAnzahl: number;
  flaecheLaengeM: number | null;
  flaecheBreiteM: number | null;
  stromNoetig: boolean;
  _count: { varianten: number; materialItems: number };
};

const STATUS_COLORS: Record<string, string> = {
  ENTWURF: "bg-zinc-700 text-zinc-300",
  BEREIT: "bg-amber-900/60 text-amber-300",
  AKTIV: "bg-emerald-900/60 text-emerald-300",
  ABGESCHLOSSEN: "bg-zinc-800 text-zinc-500",
};

const STATUS_LABELS: Record<string, string> = {
  ENTWURF: "Entwurf",
  BEREIT: "Bereit",
  AKTIV: "Aktiv",
  ABGESCHLOSSEN: "Abgeschlossen",
};

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/games")
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden");
        return res.json();
      })
      .then(setGames)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Games...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error}
      </div>
    );
  }

  const stats = {
    total: games.length,
    solo: games.filter((g) => g.modus === "SOLO").length,
    duell: games.filter((g) => g.modus === "DUELL").length,
    bereit: games.filter((g) => g.status === "BEREIT" || g.status === "AKTIV").length,
    helferTotal: games.reduce((sum, g) => sum + g.helferAnzahl, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Game-Verwaltung</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {stats.total} Games ({stats.solo} Solo, {stats.duell} Duell) &middot;{" "}
            {stats.bereit}/{stats.total} bereit &middot; {stats.helferTotal} Helfer
            total
          </p>
        </div>
        <Link
          href="/admin/games/new"
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition"
        >
          + Neues Game
        </Link>
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 text-left">
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 font-medium">Typ</th>
              <th className="px-4 py-3 font-medium">Modus</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Zeit</th>
              <th className="px-4 py-3 font-medium text-right">Fläche</th>
              <th className="px-4 py-3 font-medium text-right">Helfer</th>
              <th className="px-4 py-3 font-medium text-right">Strom</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {games.map((game) => (
              <tr
                key={game.id}
                className="hover:bg-zinc-900/40 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/games/${game.id}`}
                    className="font-medium text-white hover:text-blue-400 transition"
                  >
                    {game.name}
                  </Link>
                  {game._count.varianten > 0 && (
                    <span className="ml-2 text-xs text-zinc-500">
                      {game._count.varianten} Var.
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      game.typ === "NEU"
                        ? "bg-blue-900/40 text-blue-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {game.typ === "RETURNEE" ? "Returnee" : "Neu"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {game.modus === "SOLO" ? "Solo" : `Duell (${game.teamsProSlot})`}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[game.status]
                    }`}
                  >
                    {STATUS_LABELS[game.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                  {game.playtimeMin} min
                </td>
                <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                  {game.flaecheLaengeM && game.flaecheBreiteM
                    ? `${game.flaecheLaengeM}×${game.flaecheBreiteM}m`
                    : "–"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                  {game.helferAnzahl}
                </td>
                <td className="px-4 py-3 text-right">
                  {game.stromNoetig ? (
                    <span className="text-amber-400">&#x26A1;</span>
                  ) : (
                    <span className="text-zinc-700">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
