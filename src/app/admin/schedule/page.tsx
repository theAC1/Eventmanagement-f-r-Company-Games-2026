"use client";

import { useState, useEffect } from "react";

type Team = { id: string; name: string; nummer: number };
type Game = { id: string; name: string; status: string; teamsProSlot: number };

type SlotOutput = {
  runde: number;
  startZeit: string;
  endZeit: string;
  gameId: string;
  gameName: string;
  teamIds: string[];
  teamNames: string[];
};

type ScheduleResult = {
  slots: SlotOutput[];
  runden: number;
  endZeit: string;
  konflikte: string[];
  teamZeitplaene: Record<string, SlotOutput[]>;
};

export default function SchedulePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"matrix" | "team">("matrix");
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  // Config
  const [blockDauer, setBlockDauer] = useState(15);
  const [wechselzeit, setWechselzeit] = useState(5);
  const [startZeit, setStartZeit] = useState("09:00");

  // Quick team generator
  const [quickTeamCount, setQuickTeamCount] = useState(16);

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/games").then((r) => r.json()),
    ]).then(([t, g]) => {
      setTeams(t);
      setGames(g);
    });
  }, []);

  const readyGames = games.filter(
    (g) => g.status === "BEREIT" || g.status === "AKTIV"
  );

  const generateQuickTeams = async () => {
    setLoading(true);
    try {
      const newTeams: Team[] = [];
      for (let i = 1; i <= quickTeamCount; i++) {
        const res = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Team ${i}`, nummer: i }),
        });
        if (res.ok) newTeams.push(await res.json());
      }
      setTeams(newTeams);
    } catch {
      setError("Fehler beim Erstellen der Teams");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockDauerMin: blockDauer,
          wechselzeitMin: wechselzeit,
          startZeit,
          pausen: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  };

  // Build matrix: rows = rounds, cols = games
  const matrix: Record<number, Record<string, SlotOutput>> = {};
  if (result) {
    for (const slot of result.slots) {
      if (!matrix[slot.runde]) matrix[slot.runde] = {};
      matrix[slot.runde][slot.gameId] = slot;
    }
  }

  const uniqueGames = result
    ? Array.from(new Set(result.slots.map((s) => s.gameId))).map((id) => ({
        id,
        name: result.slots.find((s) => s.gameId === id)!.gameName,
      }))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Zeitplan-Engine</h1>

      {/* Config Panel */}
      <div className="border border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-lg font-semibold">Konfiguration</h2>

        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Blockdauer (min)
            </label>
            <input
              type="number"
              value={blockDauer}
              onChange={(e) => setBlockDauer(parseInt(e.target.value) || 15)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Wechselzeit (min)
            </label>
            <input
              type="number"
              value={wechselzeit}
              onChange={(e) => setWechselzeit(parseInt(e.target.value) || 5)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Startzeit
            </label>
            <input
              type="time"
              value={startZeit}
              onChange={(e) => setStartZeit(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Takt
            </label>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400">
              {blockDauer + wechselzeit} min
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-6 text-sm text-zinc-400">
          <span>
            Teams: <strong className="text-white">{teams.length}</strong>
          </span>
          <span>
            Games (bereit):{" "}
            <strong className="text-white">{readyGames.length}</strong>
            <span className="text-zinc-600">/{games.length} total</span>
          </span>
        </div>

        {/* Quick team generator */}
        {teams.length === 0 && (
          <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <span className="text-sm text-zinc-400">Keine Teams vorhanden.</span>
            <input
              type="number"
              min={2}
              max={30}
              value={quickTeamCount}
              onChange={(e) => setQuickTeamCount(parseInt(e.target.value) || 16)}
              className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-center"
            />
            <button
              onClick={generateQuickTeams}
              disabled={loading}
              className="px-3 py-1 bg-zinc-700 text-sm rounded hover:bg-zinc-600 transition"
            >
              Teams generieren
            </button>
          </div>
        )}

        {readyGames.length === 0 && games.length > 0 && (
          <p className="text-sm text-amber-400">
            Keine Games auf &quot;Bereit&quot; gesetzt. Geh zur Game-Verwaltung
            und setze den Status mindestens eines Games auf &quot;Bereit&quot;.
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || teams.length === 0 || readyGames.length === 0}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Generiert..." : "Zeitplan generieren"}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="flex items-center gap-6 text-sm">
            <span className="text-zinc-400">
              {result.runden} Runden &middot; {result.slots.length} Slots
              &middot; Ende: <strong className="text-white">{result.endZeit}</strong>
            </span>
            {result.konflikte.length > 0 && (
              <span className="text-red-400">
                {result.konflikte.length} Konflikte
              </span>
            )}
          </div>

          {/* Conflicts */}
          {result.konflikte.length > 0 && (
            <div className="border border-red-900/50 rounded-lg p-4 space-y-1">
              <p className="text-sm font-medium text-red-400">Konflikte:</p>
              {result.konflikte.slice(0, 10).map((k, i) => (
                <p key={i} className="text-xs text-red-300">{k}</p>
              ))}
              {result.konflikte.length > 10 && (
                <p className="text-xs text-zinc-500">
                  ... und {result.konflikte.length - 10} weitere
                </p>
              )}
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("matrix")}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                viewMode === "matrix"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              Matrix
            </button>
            <button
              onClick={() => setViewMode("team")}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                viewMode === "team"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              Team-Ansicht
            </button>
          </div>

          {/* Matrix View */}
          {viewMode === "matrix" && (
            <div className="border border-zinc-800 rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium sticky left-0 bg-zinc-900/90">
                      Runde
                    </th>
                    {uniqueGames.map((g) => (
                      <th
                        key={g.id}
                        className="px-3 py-2 text-left text-zinc-400 font-medium min-w-[120px]"
                      >
                        {g.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {Array.from({ length: result.runden }, (_, i) => i + 1).map(
                    (runde) => (
                      <tr key={runde} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 text-zinc-500 sticky left-0 bg-zinc-950/90 font-mono">
                          R{runde}
                          <span className="ml-2 text-zinc-700">
                            {matrix[runde]
                              ? Object.values(matrix[runde])[0]?.startZeit
                              : ""}
                          </span>
                        </td>
                        {uniqueGames.map((g) => {
                          const slot = matrix[runde]?.[g.id];
                          return (
                            <td key={g.id} className="px-3 py-2">
                              {slot ? (
                                <span className="text-zinc-200">
                                  {slot.teamNames.join(" vs ")}
                                </span>
                              ) : (
                                <span className="text-zinc-800">–</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Team View */}
          {viewMode === "team" && (
            <div className="space-y-4">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              >
                <option value="">Team wählen...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.nummer} {t.name}
                  </option>
                ))}
              </select>

              {selectedTeam && result.teamZeitplaene[selectedTeam] && (
                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 text-left">
                        <th className="px-4 py-2 font-medium">Runde</th>
                        <th className="px-4 py-2 font-medium">Zeit</th>
                        <th className="px-4 py-2 font-medium">Game</th>
                        <th className="px-4 py-2 font-medium">Gegen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {result.teamZeitplaene[selectedTeam].map((slot, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-zinc-500">R{slot.runde}</td>
                          <td className="px-4 py-2 tabular-nums">
                            {slot.startZeit}–{slot.endZeit}
                          </td>
                          <td className="px-4 py-2 font-medium">{slot.gameName}</td>
                          <td className="px-4 py-2 text-zinc-400">
                            {slot.teamNames.length > 1
                              ? slot.teamNames
                                  .filter(
                                    (n) =>
                                      n !==
                                      teams.find((t) => t.id === selectedTeam)
                                        ?.name
                                  )
                                  .join(", ")
                              : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
