import { Team, SlotOutput, ScheduleResult, MittagsSchicht } from "./types";
import { KpiBand, KpiCell } from "@/components/ui/kpi";

type ZeitplanErgebnisProps = {
  result: ScheduleResult;
  teams: Team[];
  viewMode: "matrix" | "team";
  selectedTeam: string;
  animate?: boolean;
  onViewModeChange: (mode: "matrix" | "team") => void;
  onSelectedTeamChange: (teamId: string) => void;
};

export function ZeitplanErgebnis({
  result,
  teams,
  viewMode,
  selectedTeam,
  animate = false,
  onViewModeChange,
  onSelectedTeamChange,
}: ZeitplanErgebnisProps) {
  const matrix = buildMatrix(result.slots);
  const uniqueGames = getUniqueGames(result.slots);

  return (
    <div className={`space-y-5 ${animate ? "anim-rise" : ""}`}>
      {/* Zusammenfassung als KPI-Band */}
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <KpiBand columns="repeat(4, minmax(0, 1fr))" className="-mb-px">
          <KpiCell label="Runden" value={result.runden} />
          <KpiCell label="Slots" value={result.slots.length} />
          <KpiCell label="Endzeit" value={result.endZeit} />
          <KpiCell
            label="Konflikte"
            value={result.konflikte.length}
            valueColor={
              result.konflikte.length > 0 ? "var(--hot-tint)" : undefined
            }
            note={result.konflikte.length === 0 ? "keine" : undefined}
            last
          />
        </KpiBand>
      </div>

      {/* Konflikte */}
      {result.konflikte.length > 0 && (
        <KonflikteAnzeige konflikte={result.konflikte} />
      )}

      {/* Mittagsschichten */}
      {result.mittagsSchichten && result.mittagsSchichten.length > 1 && (
        <MittagsSchichtenAnzeige schichten={result.mittagsSchichten} />
      )}

      {/* View Toggle als Segmented Control */}
      <div className="inline-flex rounded-[9px] border border-line-strong bg-sunken p-0.5">
        <button
          onClick={() => onViewModeChange("matrix")}
          className={`rounded-[7px] px-3 py-[5px] text-xs transition-colors duration-150 ${
            viewMode === "matrix"
              ? "bg-action font-semibold text-on-action"
              : "font-medium text-ink-3 hover:text-ink"
          }`}
        >
          Matrix
        </button>
        <button
          onClick={() => onViewModeChange("team")}
          className={`rounded-[7px] px-3 py-[5px] text-xs transition-colors duration-150 ${
            viewMode === "team"
              ? "bg-action font-semibold text-on-action"
              : "font-medium text-ink-3 hover:text-ink"
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
    <div className="space-y-1.5 rounded-[10px] border border-[var(--hot-border)] bg-hot-dim/50 p-4">
      <p className="text-[13px] font-semibold text-hot-tint">Konflikte</p>
      {konflikte.slice(0, 10).map((k, i) => (
        <p key={i} className="text-xs text-ink-2">{k}</p>
      ))}
      {konflikte.length > 10 && (
        <p className="text-xs text-ink-3">
          ... und <span className="tnum">{konflikte.length - 10}</span> weitere
        </p>
      )}
    </div>
  );
}

function MittagsSchichtenAnzeige({ schichten }: { schichten: MittagsSchicht[] }) {
  return (
    <div className="space-y-3 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim p-4">
      <p className="text-[13px] font-semibold text-warn">
        Mittagspause: <span className="tnum">{schichten.length}</span> Schichten
      </p>
      <div className="space-y-2">
        {schichten.map((s) => (
          <div
            key={s.schicht}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[9px] border border-[var(--warn-border)] px-3 py-2 text-[13px]"
          >
            <span className="text-ink-3">
              Schicht <span className="tnum">{s.schicht}</span>:{" "}
              <span className="tnum">{s.startZeit}–{s.endZeit}</span>
            </span>
            <span className="text-ink-2">{s.teamNames.join(", ")}</span>
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
    <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line bg-sunken">
            <th className="cg-label sticky left-0 bg-sunken px-3 py-[11px] text-left">
              Runde
            </th>
            {uniqueGames.map((g) => (
              <th
                key={g.id}
                className="cg-label min-w-[120px] whitespace-nowrap px-3 py-[11px] text-left"
              >
                {g.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: runden }, (_, i) => i + 1).map((runde) => (
            <tr
              key={runde}
              className="border-b border-line-soft transition-colors duration-150 last:border-b-0 hover:bg-sunken/60"
            >
              <td className="tnum sticky left-0 whitespace-nowrap bg-bg px-3 py-2.5 text-ink-2">
                R{runde}
                <span className="ml-2 text-label">
                  {matrix[runde]
                    ? Object.values(matrix[runde])[0]?.startZeit
                    : ""}
                </span>
              </td>
              {uniqueGames.map((g) => {
                const slot = matrix[runde]?.[g.id];
                return slot ? (
                  <td key={g.id} className="bg-action-row px-3 py-2.5 text-ink">
                    {slot.teamNames.join(" vs ")}
                  </td>
                ) : (
                  <td key={g.id} className="px-3 py-2.5 text-faint">
                    –
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
        className="h-[38px] w-full max-w-xs rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink outline-none transition-colors duration-150 focus:border-action"
      >
        <option value="">Team w&auml;hlen...</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            #{t.nummer} {t.name}
          </option>
        ))}
      </select>

      {selectedTeam && teamZeitplaene[selectedTeam] && (
        <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-sunken text-left">
                <th className="cg-label px-4 py-[11px]">Runde</th>
                <th className="cg-label px-4 py-[11px]">Zeit</th>
                <th className="cg-label px-4 py-[11px]">Game</th>
                <th className="cg-label px-4 py-[11px]">Gegen</th>
              </tr>
            </thead>
            <tbody>
              {teamZeitplaene[selectedTeam].map((slot, i) => (
                <tr
                  key={i}
                  className="border-b border-line-soft transition-colors duration-150 last:border-b-0 hover:bg-sunken/60"
                >
                  <td className="tnum px-4 py-2.5 text-xs text-ink-3">
                    R{slot.runde}
                  </td>
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-xs text-ink-2">
                    {slot.startZeit}–{slot.endZeit}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {slot.gameName}
                  </td>
                  <td className="px-4 py-2.5 text-ink-3">
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
