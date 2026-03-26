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
  platzierungen: Record<number, number>;
};

type RanglisteResponse = {
  rangliste: RanglisteEntry[];
  totalGames: number;
  totalTeams: number;
  ergebnisseEingetragen: number;
};

export default function ScoreboardPage() {
  const [data, setData] = useState<RanglisteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = () => {
    fetch("/api/rangliste")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLastUpdate(new Date());
        setFetchError(null);
      })
      .catch((err) => {
        setFetchError(`Verbindung verloren: ${err.message}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // Auto-refresh alle 10 Sekunden (bis Socket.io kommt)
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-500">Lade Rangliste...</p>
      </div>
    );
  }

  if (!data || data.rangliste.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold">Company Games 2026</h1>
        <p className="text-zinc-400">Noch keine Ergebnisse eingetragen</p>
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition">
          Startseite
        </Link>
      </div>
    );
  }

  const progressPct = data.totalGames > 0 && data.totalTeams > 0
    ? Math.round((data.ergebnisseEingetragen / (data.totalGames * data.totalTeams)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold tracking-tight">
              Company Games 2026
            </h1>
            <span className="text-xs text-zinc-500">Live Rangliste</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              {data.ergebnisseEingetragen}/{data.totalGames * data.totalTeams} Ergebnisse
            </span>
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {lastUpdate && (
              <span>{lastUpdate.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
            {fetchError && (
              <span className="text-red-400">● Offline</span>
            )}
          </div>
        </div>
      </header>

      {/* Rangliste */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-1">
          {data.rangliste.map((entry, idx) => {
            const isTop3 = idx < 3;
            const medalColors = [
              "from-amber-600/20 to-amber-900/10 border-amber-700/50",
              "from-zinc-400/15 to-zinc-700/10 border-zinc-500/40",
              "from-orange-700/15 to-orange-900/10 border-orange-800/40",
            ];

            return (
              <div
                key={entry.teamId}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition ${
                  isTop3
                    ? `bg-gradient-to-r ${medalColors[idx]}`
                    : "border-zinc-800/30 hover:border-zinc-800"
                }`}
              >
                {/* Rang */}
                <div
                  className={`w-8 text-right font-bold tabular-nums ${
                    isTop3 ? "text-2xl" : "text-lg text-zinc-500"
                  }`}
                >
                  {entry.gesamtRang}
                </div>

                {/* Team */}
                <div className="flex-1">
                  <span className={`font-medium ${isTop3 ? "text-lg" : ""}`}>
                    {entry.teamName}
                  </span>
                </div>

                {/* Games absolviert */}
                <div className="text-xs text-zinc-500 tabular-nums">
                  {entry.gamesGespielt}/{entry.gamesTotal}
                </div>

                {/* Rangpunkte */}
                <div
                  className={`font-bold tabular-nums ${
                    isTop3 ? "text-xl" : "text-zinc-300"
                  }`}
                >
                  {entry.rangPunkteSumme}
                </div>

                <span className="text-xs text-zinc-600">Rangpunkte</span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
