import { Team, Game } from "./types";

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
  error: string | null;
  loadedConfigId: string | null;
  saveName: string;
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
  onGenerate: () => void;
};

export function KonfigurationPanel({
  teams,
  games,
  loading,
  error,
  loadedConfigId,
  saveName,
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
  onGenerate,
}: KonfigurationPanelProps) {
  const readyGames = games.filter(
    (g) => g.status === "BEREIT" || g.status === "AKTIV"
  );

  return (
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
            onChange={(e) => onBlockDauerChange(parseInt(e.target.value) || 15)}
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
            onChange={(e) => onWechselzeitChange(parseInt(e.target.value) || 5)}
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
            onChange={(e) => onStartZeitChange(e.target.value)}
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

      {/* Mittagspause */}
      <MittagspauseSection
        mittag={mittag}
        teamsCount={teams.length}
        onMittagChange={onMittagChange}
      />

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
            onChange={(e) => onQuickTeamCountChange(parseInt(e.target.value) || 16)}
            className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-center"
          />
          <button
            onClick={onGenerateQuickTeams}
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

      <div className="flex items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={loading || teams.length === 0 || readyGames.length === 0}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Generiert..." : "Zeitplan generieren"}
        </button>
        {loadedConfigId && (
          <span className="text-xs text-blue-400">
            Geladen: {saveName}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
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
    <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Mittagspause</h3>
        <button
          onClick={() => onMittagChange({ mittagAktiv: !mittagAktiv })}
          className={`px-3 py-1 text-xs rounded-lg border transition ${
            mittagAktiv
              ? "bg-emerald-900/40 border-emerald-700 text-emerald-300"
              : "bg-zinc-900 border-zinc-700 text-zinc-500"
          }`}
        >
          {mittagAktiv ? "Aktiv" : "Aus"}
        </button>
      </div>
      {mittagAktiv && (
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Nach Runde</label>
            <input
              type="number"
              min={1}
              value={mittagNachRunde}
              onChange={(e) => onMittagChange({ mittagNachRunde: parseInt(e.target.value) || 6 })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Dauer (min)</label>
            <input
              type="number"
              min={15}
              step={5}
              value={mittagDauer}
              onChange={(e) => onMittagChange({ mittagDauer: parseInt(e.target.value) || 45 })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Max Teams gleichzeitig</label>
            <input
              type="number"
              min={1}
              value={mittagMaxTeams}
              onChange={(e) => onMittagChange({ mittagMaxTeams: parseInt(e.target.value) || 8 })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Versatz (min)</label>
            <input
              type="number"
              min={0}
              step={5}
              value={mittagVersatz}
              onChange={(e) => onMittagChange({ mittagVersatz: parseInt(e.target.value) || 5 })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>
      )}
      {mittagAktiv && teamsCount > mittagMaxTeams && (
        <p className="text-xs text-amber-400">
          {teamsCount} Teams &gt; {mittagMaxTeams} Kapazit&auml;t →{" "}
          {Math.ceil(teamsCount / mittagMaxTeams)} Schichten mit je{" "}
          {mittagVersatz} min Versatz
        </p>
      )}
    </div>
  );
}
