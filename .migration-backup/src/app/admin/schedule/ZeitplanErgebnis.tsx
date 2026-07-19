import { Team, SlotOutput, ScheduleResult } from "./types";

type ZeitplanErgebnisProps = {
  result: ScheduleResult;
  teams: Team[];
  viewMode: "matrix" | "team";
  selectedTeam: string;
  onViewModeChange: (mode: "matrix" | "team") => void;
  onSelectedTeamChange: (teamId: string) => void;
};

export function ZeitplanErgebnis({
  result,
  teams,
  viewMode,
  selectedTeam,
  onViewModeChange,
  onSelectedTeamChange,
}: ZeitplanErgebnisProps) {
  const matrix = buildMatrix(result.slots);
  const uniqueGames = getUniqueGames(result.slots);

  return (
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
        <KonflikteAnzeige konflikte={result.konflikte} />
      )}

      {/* Mittagsschichten */}
      {result.mittagsSchichten && result.mittagsSchichten.length > 1 && (
        <MittagsSchichtenAnzeige schichten={result.mittagsSchichten} />
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onViewModeChange("matrix")}
          className={`px-3 py-1.5 text-sm rounded-lg transition ${
            viewMode === "matrix"
              ? "bg-zinc-700 text-white"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          Matrix
        </button>
        <button
          onClick={() => onViewModeChange("team")}
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
        <MatrixAnsicht
          matrix={matrix}
          uniqueGames={uniqueGames}
          runden={result.runden}
        />
      )}

      {/* Team View */}
      {viewMode === "team" && (
        <TeamAnsicht
          teams={teams}
          selectedTeam={selectedTeam}
          teamZeitplaene={result.teamZeitplaene}
          onSelectedTeamChange={onSelectedTeamChange}
        />
      )}
    </div>
  );
}

// --- Helper functions ---

function buildMatrix(slots: SlotOutput[]): Record<number, Record<string, SlotOutput>> {
  const matrix: Record<number, Record<string, SlotOutput>> = {};
  for (const slot of slots) {
    if (!matrix[slot.runde]) matrix[slot.runde] = {};
    matrix[slot.runde][slot.gameId] = slot;
  }
  return matrix;
}

function getUniqueGames(slots: SlotOutput[]): { id: string; name: string }[] {
  return Array.from(new Set(slots.map((s) => s.gameId))).map((id) => ({
    id,
    name: slots.find((s) => s.gameId === id)!.gameName,
  }));
}

// --- Sub-components ---

function KonflikteAnzeige({ konflikte }: { konflikte: string[] }) {
  return (
    <div className="border border-red-900/50 rounded-lg p-4 space-y-1">
      <p className="text-sm font-medium text-red-400">Konflikte:</p>
      {konflikte.slice(0, 10).map((k, i) => (
        <p key={i} className="text-xs text-red-300">{k}</p>
      ))}
      {konflikte.length > 10 && (
        <p className="text-xs text-zinc-500">
          ... und {konflikte.length - 10} weitere
        </p>
      )}
    </div>
  );
}

function MittagsSchichtenAnzeige({
  schichten,
}: {
  schichten: { schicht: number; startZeit: string; endZeit: string; teamNames: string[] }[];
}) {
  return (
    <div className="border border-amber-800/50 bg-amber-950/20 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-amber-300">
        Mittagspause: {schichten.length} Schichten
      </p>
      <div className="space-y-2">
        {schichten.map((s) => (
          <div
            key={s.schicht}
            className="flex items-center justify-between text-sm border border-amber-900/30 rounded px-3 py-2"
          >
            <span className="text-zinc-400">
              Schicht {s.schicht}: {s.startZeit}–{s.endZeit}
            </span>
            <span className="text-zinc-300">
              {s.teamNames.join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatrixAnsicht({
  matrix,
  uniqueGames,
  runden,
}: {
  matrix: Record<number, Record<string, SlotOutput>>;
  uniqueGames: { id: string; name: string }[];
  runden: number;
}) {
  return (
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
          {Array.from({ length: runden }, (_, i) => i + 1).map((runde) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamAnsicht({
  teams,
  selectedTeam,
  teamZeitplaene,
  onSelectedTeamChange,
}: {
  teams: Team[];
  selectedTeam: string;
  teamZeitplaene: Record<string, SlotOutput[]>;
  onSelectedTeamChange: (teamId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <select
        value={selectedTeam}
        onChange={(e) => onSelectedTeamChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
      >
        <option value="">Team waehlen...</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            #{t.nummer} {t.name}
          </option>
        ))}
      </select>

      {selectedTeam && teamZeitplaene[selectedTeam] && (
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
              {teamZeitplaene[selectedTeam].map((slot, i) => (
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
                              teams.find((t) => t.id === selectedTeam)?.name
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
  );
}
