import { Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Team, Game } from "./types";

const INPUT_CLASS =
  "w-full h-[38px] rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink outline-none transition-colors duration-150 focus:border-action";

type MittagConfig = {
  mittagAktiv: boolean;
  mittagNachRunde: number;
  mittagDauer: number;
  mittagMaxTeams: number;
  mittagVersatz: number;
};

type KonfigurationPanelProps = {
  teams: Team[];
  games: Game[];
  loading: boolean;
  blockDauer: number;
  wechselzeit: number;
  startZeit: string;
  mittag: MittagConfig;
  quickTeamCount: number;
  onBlockDauerChange: (val: number) => void;
  onWechselzeitChange: (val: number) => void;
  onStartZeitChange: (val: string) => void;
  onMittagChange: (update: Partial<MittagConfig>) => void;
  onQuickTeamCountChange: (val: number) => void;
  onGenerateQuickTeams: () => void;
};

export function KonfigurationPanel({
  teams,
  games,
  loading,
  blockDauer,
  wechselzeit,
  startZeit,
  mittag,
  quickTeamCount,
  onBlockDauerChange,
  onWechselzeitChange,
  onStartZeitChange,
  onMittagChange,
  onQuickTeamCountChange,
  onGenerateQuickTeams,
}: KonfigurationPanelProps) {
  const readyGames = games.filter(
    (g) => g.status === "BEREIT" || g.status === "AKTIV"
  );

  return (
    <section className="space-y-5 rounded-[10px] border border-line bg-surface p-5">
      <h2 className="cg-label">Konfiguration</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <label className="cg-label">Blockdauer (min)</label>
          <input
            type="number"
            value={blockDauer}
            onChange={(e) => onBlockDauerChange(parseInt(e.target.value) || 15)}
            className={`${INPUT_CLASS} tnum`}
          />
        </div>
        <div className="space-y-1.5">
          <label className="cg-label">Wechselzeit (min)</label>
          <input
            type="number"
            value={wechselzeit}
            onChange={(e) => onWechselzeitChange(parseInt(e.target.value) || 5)}
            className={`${INPUT_CLASS} tnum`}
          />
        </div>
        <div className="space-y-1.5">
          <label className="cg-label">Startzeit</label>
          <input
            type="time"
            value={startZeit}
            onChange={(e) => onStartZeitChange(e.target.value)}
            className={`${INPUT_CLASS} tnum`}
          />
        </div>
        <div className="space-y-1.5">
          <label className="cg-label">Takt</label>
          <div className="tnum flex h-[38px] items-center rounded-[9px] border border-line bg-sunken px-3 text-sm text-ink-3">
            {blockDauer + wechselzeit} min
          </div>
        </div>
      </div>

      {/* Mittagspause */}
      <MittagspauseSection
        mittag={mittag}
        teamsCount={teams.length}
        onMittagChange={onMittagChange}
      />

      {/* Status */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-ink-3">
        <span>
          Teams:{" "}
          <strong className="tnum font-semibold text-ink">{teams.length}</strong>
        </span>
        <span>
          Games (bereit):{" "}
          <strong className="tnum font-semibold text-ink">
            {readyGames.length}
          </strong>
          <span className="tnum text-faint">/{games.length} total</span>
        </span>
      </div>

      {/* Quick team generator */}
      {teams.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-sunken p-3">
          <span className="text-[13px] text-ink-3">Keine Teams vorhanden.</span>
          <input
            type="number"
            min={2}
            max={30}
            value={quickTeamCount}
            onChange={(e) => onQuickTeamCountChange(parseInt(e.target.value) || 16)}
            className="tnum h-[34px] w-16 rounded-[9px] border border-line-strong bg-surface px-2 text-center text-sm text-ink outline-none transition-colors duration-150 focus:border-action"
          />
          <Button variant="ghost" onClick={onGenerateQuickTeams} disabled={loading}>
            Teams generieren
          </Button>
        </div>
      )}

      {readyGames.length === 0 && games.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-2.5 text-[13px] text-ink-2">
          <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-warn" />
          <span>
            Keine Games auf &quot;Bereit&quot; gesetzt. Geh zur Game-Verwaltung
            und setze den Status mindestens eines Games auf &quot;Bereit&quot;.
          </span>
        </div>
      )}
    </section>
  );
}

function Switch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-[22px] w-[40px] shrink-0 rounded-full border transition-colors duration-150 ${
        checked
          ? "border-action bg-action"
          : "border-line-strong bg-sunken"
      }`}
    >
      <span
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all duration-150 ${
          checked ? "left-[19px] bg-on-action" : "left-[3px] bg-ink-3"
        }`}
      />
    </button>
  );
}

function MittagspauseSection({
  mittag,
  teamsCount,
  onMittagChange,
}: {
  mittag: MittagConfig;
  teamsCount: number;
  onMittagChange: (update: Partial<MittagConfig>) => void;
}) {
  const { mittagAktiv, mittagNachRunde, mittagDauer, mittagMaxTeams, mittagVersatz } = mittag;

  return (
    <div className="space-y-4 rounded-[10px] border border-line p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">Mittagspause</h3>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-ink-3">
            {mittagAktiv ? "Aktiv" : "Aus"}
          </span>
          <Switch
            checked={mittagAktiv}
            onToggle={() => onMittagChange({ mittagAktiv: !mittagAktiv })}
            label="Mittagspause"
          />
        </div>
      </div>
      {mittagAktiv && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label className="cg-label">Nach Runde</label>
            <input
              type="number"
              min={1}
              value={mittagNachRunde}
              onChange={(e) => onMittagChange({ mittagNachRunde: parseInt(e.target.value) || 6 })}
              className={`${INPUT_CLASS} tnum`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="cg-label">Dauer (min)</label>
            <input
              type="number"
              min={15}
              step={5}
              value={mittagDauer}
              onChange={(e) => onMittagChange({ mittagDauer: parseInt(e.target.value) || 45 })}
              className={`${INPUT_CLASS} tnum`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="cg-label">Max Teams gleichzeitig</label>
            <input
              type="number"
              min={1}
              value={mittagMaxTeams}
              onChange={(e) => onMittagChange({ mittagMaxTeams: parseInt(e.target.value) || 8 })}
              className={`${INPUT_CLASS} tnum`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="cg-label">Versatz (min)</label>
            <input
              type="number"
              min={0}
              step={5}
              value={mittagVersatz}
              onChange={(e) => onMittagChange({ mittagVersatz: parseInt(e.target.value) || 5 })}
              className={`${INPUT_CLASS} tnum`}
            />
          </div>
        </div>
      )}
      {mittagAktiv && teamsCount > mittagMaxTeams && (
        <p className="text-[11px] text-ink-3">
          <span className="tnum">{teamsCount}</span> Teams &gt;{" "}
          <span className="tnum">{mittagMaxTeams}</span> Kapazit&auml;t →{" "}
          <span className="tnum">{Math.ceil(teamsCount / mittagMaxTeams)}</span>{" "}
          Schichten mit je <span className="tnum">{mittagVersatz}</span> min
          Versatz
        </p>
      )}
    </div>
  );
}
