import { Team, SlotOutput, ScheduleResult, MittagsWelle, TurnierFenster } from "./types";
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
  const konflikteHart = result.konflikte.filter((k) => k.startsWith("HART"));
  const konflikteWeich = result.konflikte.filter((k) => !k.startsWith("HART"));

  return (
    <div className={`space-y-5 ${animate ? "anim-rise" : ""}`}>
      {/* Zusammenfassung als KPI-Band */}
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <KpiBand columns="repeat(5, minmax(0, 1fr))" className="-mb-px">
          <KpiCell label="Runden" value={result.runden} />
          <KpiCell label="Slots" value={result.slots.length} />
          <KpiCell
            label="Ende"
            value={result.endZeit}
            note={
              result.fenster?.endeSoll ? `Fenster bis ${result.fenster.endeSoll}` : undefined
            }
            valueColor={
              result.fenster && !result.fenster.passt ? "var(--hot-tint)" : undefined
            }
          />
          <KpiCell
            label="Freirunden pro Team"
            value={freirundenSpanne(result)}
            note="zum Zuschauen"
          />
          <KpiCell
            label="Konflikte"
            value={konflikteHart.length}
            valueColor={konflikteHart.length > 0 ? "var(--hot-tint)" : undefined}
            note={
              konflikteHart.length === 0
                ? konflikteWeich.length > 0
                  ? `${konflikteWeich.length} Hinweise`
                  : "keine"
                : undefined
            }
            last
          />
        </KpiBand>
      </div>

      {result.fenster && <FensterHinweis fenster={result.fenster} />}

      {konflikteHart.length > 0 && (
        <KonflikteAnzeige titel="Konflikte" ton="hot" konflikte={konflikteHart} />
      )}
      {konflikteWeich.length > 0 && (
        <KonflikteAnzeige titel="Hinweise" ton="warn" konflikte={konflikteWeich} />
      )}

      {result.mittagsWellen && result.mittagsWellen.length > 0 && (
        <MittagsWellenAnzeige wellen={result.mittagsWellen} />
      )}

      {result.statistiken && <VerteilungAnzeige result={result} teams={teams} />}

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

      {viewMode === "matrix" && (
        <MatrixAnsicht
          matrix={matrix}
          uniqueGames={uniqueGames}
          runden={result.runden}
        />
      )}

      {viewMode === "team" && (
        <TeamAnsicht
          teams={teams}
          selectedTeam={selectedTeam}
          teamZeitplaene={result.teamZeitplaene}
          mittagsWellen={result.mittagsWellen ?? []}
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

/** "5–7" oder "6", je nachdem wie gleichmässig die Freirunden liegen. */
function freirundenSpanne(result: ScheduleResult): string {
  const werte = Object.values(result.statistiken?.freirundenProTeam ?? {});
  if (werte.length === 0) return "–";
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  return min === max ? String(min) : `${min}–${max}`;
}

/** Der wievielte Durchgang dieses Games ist der Slot für dieses Team? */
function durchgangNummern(slots: SlotOutput[]): Map<SlotOutput, [number, number]> {
  const gesamt = new Map<string, number>();
  for (const s of slots) gesamt.set(s.gameId, (gesamt.get(s.gameId) ?? 0) + 1);

  const laufend = new Map<string, number>();
  const ergebnis = new Map<SlotOutput, [number, number]>();
  for (const s of slots) {
    const n = (laufend.get(s.gameId) ?? 0) + 1;
    laufend.set(s.gameId, n);
    ergebnis.set(s, [n, gesamt.get(s.gameId) ?? 1]);
  }
  return ergebnis;
}

// --- Sub-components ---

function FensterHinweis({ fenster }: { fenster: TurnierFenster }) {
  if (!fenster.endeSoll || fenster.passt) return null;
  return (
    <div className="rounded-[10px] border border-[var(--hot-border)] bg-hot-dim/50 px-3.5 py-2.5 text-[13px] text-ink-2">
      Der Plan endet um <span className="tnum font-semibold">{fenster.endeIst}</span>{" "}
      und &uuml;berzieht das Turnierfenster (bis{" "}
      <span className="tnum">{fenster.endeSoll}</span>) um{" "}
      <span className="tnum font-semibold">{fenster.ueberzugMin} min</span>.
    </div>
  );
}

function KonflikteAnzeige({
  titel,
  ton,
  konflikte,
}: {
  titel: string;
  ton: "hot" | "warn";
  konflikte: string[];
}) {
  const rahmen =
    ton === "hot"
      ? "border-[var(--hot-border)] bg-hot-dim/50"
      : "border-[var(--warn-border)] bg-warn-dim";
  const farbe = ton === "hot" ? "text-hot-tint" : "text-warn";

  return (
    <div className={`space-y-1.5 rounded-[10px] border p-4 ${rahmen}`}>
      <p className={`text-[13px] font-semibold ${farbe}`}>
        {titel} <span className="tnum">({konflikte.length})</span>
      </p>
      {konflikte.slice(0, 10).map((k, i) => (
        <p key={i} className="text-xs text-ink-2">
          {k}
        </p>
      ))}
      {konflikte.length > 10 && (
        <p className="text-xs text-ink-3">
          ... und <span className="tnum">{konflikte.length - 10}</span> weitere
        </p>
      )}
    </div>
  );
}

function MittagsWellenAnzeige({ wellen }: { wellen: MittagsWelle[] }) {
  const personen = wellen.reduce((s, w) => s + w.personenTotal, 0);

  return (
    <div className="space-y-3 rounded-[10px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[13px] font-semibold text-ink">
          Mittag: <span className="tnum">{wellen.length}</span> Wellen
        </p>
        <p className="text-[11px] text-ink-3">
          <span className="tnum">{wellen[0].startZeit}</span>&ndash;
          <span className="tnum">{wellen[wellen.length - 1].endZeit}</span> &middot;{" "}
          <span className="tnum">{personen}</span> Personen &middot; der Betrieb
          l&auml;uft weiter
        </p>
      </div>
      <div className="space-y-2">
        {wellen.map((w) => (
          <div
            key={w.welle}
            className="grid gap-x-4 gap-y-1 rounded-[9px] border border-line bg-sunken px-3 py-2 text-[12px] sm:grid-cols-[120px_1fr_auto]"
          >
            <span className="tnum font-medium text-ink">
              {w.startZeit}&ndash;{w.endZeit}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-ink-2">{w.teamNamen.join(", ") || "keine Teams"}</p>
              {w.postenNamen.length > 0 && (
                <p className="text-ink-3">
                  Posten-Crew: {w.postenNamen.join(", ")}
                </p>
              )}
              {w.helferNamen.length > 0 && (
                <p className="text-ink-3">Helfer: {w.helferNamen.join(", ")}</p>
              )}
            </div>
            <span className="tnum whitespace-nowrap text-ink-3">
              {w.personenTotal} Pers.
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Wie gleichmässig liegt der Tag über die Teams? */
function VerteilungAnzeige({
  result,
  teams,
}: {
  result: ScheduleResult;
  teams: Team[];
}) {
  const stat = result.statistiken!;
  const zeilen = teams
    .map((t) => ({
      team: t,
      posten: result.teamZeitplaene[t.id]?.length ?? 0,
      vormittag: stat.postenVormittagProTeam[t.id] ?? 0,
      frei: stat.freirundenProTeam[t.id] ?? 0,
      serie: stat.laengsteSerieProTeam[t.id] ?? 0,
    }))
    .filter((z) => z.posten > 0);

  if (zeilen.length === 0) return null;

  return (
    <details className="rounded-[10px] border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-ink">
        Verteilung pro Team{" "}
        <span className="font-normal text-ink-3">
          (Soll: {stat.postenProTeam} Posten, davon ein Teil vor dem Mittag)
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line bg-sunken text-left">
              <th className="cg-label px-4 py-2.5">Team</th>
              <th className="cg-label px-4 py-2.5 text-right">Posten</th>
              <th className="cg-label px-4 py-2.5 text-right">vor Mittag</th>
              <th className="cg-label px-4 py-2.5 text-right">nach Mittag</th>
              <th className="cg-label px-4 py-2.5 text-right">frei</th>
              <th className="cg-label px-4 py-2.5 text-right">längste Serie</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.team.id} className="border-b border-line-soft last:border-b-0">
                <td className="px-4 py-2 text-ink-2">
                  #{z.team.nummer} {z.team.name}
                </td>
                <td className="tnum px-4 py-2 text-right text-ink">{z.posten}</td>
                <td className="tnum px-4 py-2 text-right text-ink-3">{z.vormittag}</td>
                <td className="tnum px-4 py-2 text-right text-ink-3">
                  {z.posten - z.vormittag}
                </td>
                <td className="tnum px-4 py-2 text-right text-ink-3">{z.frei}</td>
                <td className="tnum px-4 py-2 text-right text-ink-3">{z.serie}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
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
                  {matrix[runde] ? Object.values(matrix[runde])[0]?.startZeit : ""}
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
  mittagsWellen,
  onSelectedTeamChange,
}: {
  teams: Team[];
  selectedTeam: string;
  teamZeitplaene: Record<string, SlotOutput[]>;
  mittagsWellen: MittagsWelle[];
  onSelectedTeamChange: (teamId: string) => void;
}) {
  const eigene = selectedTeam ? (teamZeitplaene[selectedTeam] ?? []) : [];
  const nummern = durchgangNummern(eigene);
  const welle = mittagsWellen.find((w) => w.teamIds.includes(selectedTeam));
  const teamName = teams.find((t) => t.id === selectedTeam)?.name;

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

      {welle && (
        <p className="rounded-[10px] border border-line bg-sunken px-3.5 py-2.5 text-[13px] text-ink-2">
          Mittagswelle:{" "}
          <span className="tnum font-semibold text-ink">
            {welle.startZeit}&ndash;{welle.endZeit}
          </span>
        </p>
      )}

      {selectedTeam && eigene.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-sunken text-left">
                <th className="cg-label px-4 py-[11px]">Runde</th>
                <th className="cg-label px-4 py-[11px]">Zeit</th>
                <th className="cg-label px-4 py-[11px]">Posten</th>
                <th className="cg-label px-4 py-[11px]">Gegen</th>
              </tr>
            </thead>
            <tbody>
              {eigene.map((slot, i) => {
                const [nr, von] = nummern.get(slot) ?? [1, 1];
                return (
                  <tr
                    key={i}
                    className="border-b border-line-soft transition-colors duration-150 last:border-b-0 hover:bg-sunken/60"
                  >
                    <td className="tnum px-4 py-2.5 text-xs text-ink-3">R{slot.runde}</td>
                    <td className="tnum whitespace-nowrap px-4 py-2.5 text-xs text-ink-2">
                      {slot.startZeit}&ndash;{slot.endZeit}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {slot.gameName}
                      {von > 1 && (
                        <span className="tnum ml-2 text-[11px] font-normal text-ink-3">
                          {nr}. von {von}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-3">
                      {slot.teamNames.filter((n) => n !== teamName).join(", ") || "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
