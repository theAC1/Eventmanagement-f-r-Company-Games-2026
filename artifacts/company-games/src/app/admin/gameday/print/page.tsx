"use client";

import { useEffect, useState } from "react";

type RanglisteEntry = {
  teamId: string;
  teamName: string;
  rangPunkteSumme: number;
  gamesGespielt: number;
  gamesTotal: number;
  gesamtRang: number;
  platzierungen: Record<number, number>;
};

type ErgebnisEntry = {
  id: string;
  gamePunkte: number | null;
  rangImGame: number | null;
  status: string;
  game: { name: string };
  team: { name: string; nummer: number };
};

export default function PrintPage() {
  const [rangliste, setRangliste] = useState<RanglisteEntry[]>([]);
  const [ergebnisse, setErgebnisse] = useState<ErgebnisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ totalGames: 0, totalTeams: 0, eingetragen: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/rangliste").then((r) => r.json()),
      fetch("/api/ergebnisse").then((r) => r.json()),
    ]).then(([rang, erg]) => {
      setRangliste(rang.rangliste ?? []);
      setErgebnisse(Array.isArray(erg) ? erg : []);
      setMeta({
        totalGames: rang.totalGames ?? 0,
        totalTeams: rang.totalTeams ?? 0,
        eingetragen: rang.ergebnisseEingetragen ?? 0,
      });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Lade Daten...</div>;
  }

  // Ergebnisse nach Game gruppieren
  const gameMap = new Map<string, ErgebnisEntry[]>();
  for (const e of ergebnisse) {
    const list = gameMap.get(e.game.name) ?? [];
    list.push(e);
    gameMap.set(e.game.name, list);
  }

  const now = new Date().toLocaleString("de-CH");
  const totalSlots = meta.totalGames * meta.totalTeams;
  const pct = totalSlots > 0 ? Math.round((meta.eingetragen / totalSlots) * 100) : 0;

  return (
    <div className="max-w-[800px] mx-auto p-8 text-black bg-white min-h-screen print:p-4">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Print Button */}
      <div className="no-print mb-6 flex items-center gap-3">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800"
        >
          Als PDF drucken (Ctrl+P)
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
        >
          Schliessen
        </button>
      </div>

      {/* Header */}
      <header className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">Company Games 2026</h1>
        <div className="flex justify-between text-sm text-gray-600 mt-1">
          <span>Gesamtrangliste</span>
          <span>{now}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {meta.eingetragen}/{totalSlots} Ergebnisse ({pct}%) · {meta.totalTeams} Teams · {meta.totalGames} Games
        </div>
      </header>

      {/* Rangliste */}
      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 w-12">Rang</th>
            <th className="py-2">Team</th>
            <th className="py-2 text-right w-16">Spiele</th>
            <th className="py-2 text-right w-20">Punkte</th>
            <th className="py-2 text-right w-12">1.</th>
            <th className="py-2 text-right w-12">2.</th>
            <th className="py-2 text-right w-12">3.</th>
          </tr>
        </thead>
        <tbody>
          {rangliste.map((r, idx) => (
            <tr key={r.teamId} className={`border-b border-gray-200 ${idx < 3 ? "font-semibold" : ""}`}>
              <td className="py-1.5">{r.gesamtRang}</td>
              <td className="py-1.5">{r.teamName}</td>
              <td className="py-1.5 text-right text-gray-500">
                {r.gamesGespielt}/{r.gamesTotal}
              </td>
              <td className="py-1.5 text-right font-mono">{r.rangPunkteSumme}</td>
              <td className="py-1.5 text-right text-gray-500">{r.platzierungen[1] ?? 0}</td>
              <td className="py-1.5 text-right text-gray-500">{r.platzierungen[2] ?? 0}</td>
              <td className="py-1.5 text-right text-gray-500">{r.platzierungen[3] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Ergebnisse pro Game */}
      <div className="page-break" />
      <h2 className="text-lg font-bold border-b-2 border-black pb-2 mb-4">Ergebnisse pro Game</h2>
      {[...gameMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([gameName, results]) => (
          <div key={gameName} className="mb-6">
            <h3 className="text-sm font-semibold mb-1">{gameName}</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left text-gray-500">
                  <th className="py-1 w-10">Rang</th>
                  <th className="py-1">Team</th>
                  <th className="py-1 text-right w-16">Punkte</th>
                  <th className="py-1 text-right w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .sort((a, b) => (a.rangImGame ?? 99) - (b.rangImGame ?? 99))
                  .map((e) => (
                    <tr key={e.id} className="border-b border-gray-100">
                      <td className="py-1">{e.rangImGame ?? "–"}</td>
                      <td className="py-1">
                        #{e.team.nummer} {e.team.name}
                      </td>
                      <td className="py-1 text-right font-mono">{e.gamePunkte ?? "–"}</td>
                      <td className="py-1 text-right text-gray-400">{e.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400 text-center">
        Company Games 2026 · Exportiert am {now}
      </footer>
    </div>
  );
}
