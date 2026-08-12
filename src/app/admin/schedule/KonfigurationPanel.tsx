import { Info, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formatDauer, parseZeit } from "@/lib/zeit";
import { Team, Game, MittagsfensterParameter } from "./types";

const INPUT_CLASS =
  "w-full h-[38px] rounded-[9px] border border-line-strong bg-sunken px-3 text-sm text-ink outline-none transition-colors duration-150 focus:border-action";

type AntiKorrConfig = {
  antiKorrAktiv: boolean;
  antiKorrGameX: string;
  antiKorrGameY: string;
};

type KonfigurationPanelProps = {
  teams: Team[];
  games: Game[];
  loading: boolean;
  /** Gameday läuft — Parameter sind schreibgeschützt. */
  gesperrt: boolean;
  blockDauer: number;
  wechselzeit: number;
  startZeit: string;
  fensterEnde: string;
  postenVormittag: number | null;
  mittagAktiv: boolean;
  mittag: MittagsfensterParameter;
  antiKorr: AntiKorrConfig;
  quickTeamCount: number;
  onBlockDauerChange: (val: number) => void;
  onWechselzeitChange: (val: number) => void;
  onStartZeitChange: (val: string) => void;
  onFensterEndeChange: (val: string) => void;
  onPostenVormittagChange: (val: number | null) => void;
  onMittagAktivChange: (val: boolean) => void;
  onMittagChange: (update: Partial<MittagsfensterParameter>) => void;
  onAntiKorrChange: (update: Partial<AntiKorrConfig>) => void;
  onQuickTeamCountChange: (val: number) => void;
  onGenerateQuickTeams: () => void;
};

/**
 * Untere Schranke für die Rundenzahl. Dieselbe Rechnung wie in der Engine,
 * hier nur zur Vorschau: die Orga soll vor dem Generieren sehen, ob der Tag
 * überhaupt ins Fenster passt.
 */
function mindestRunden(anzahlTeams: number, games: Game[]): number {
  if (anzahlTeams === 0 || games.length === 0) return 0;
  const postenProTeam = games.reduce((s, g) => s + g.durchgaenge, 0);
  let proGame = 0;
  let kapazitaet = 0;
  for (const g of games) {
    const proSlot = Math.max(1, g.teamsProSlot);
    proGame = Math.max(proGame, Math.ceil((anzahlTeams * g.durchgaenge) / proSlot));
    kapazitaet += proSlot;
  }
  const kapazitaetsSchranke = Math.ceil((anzahlTeams * postenProTeam) / kapazitaet);
  return Math.max(postenProTeam, proGame, kapazitaetsSchranke, 1);
}

export function KonfigurationPanel({
  teams,
  games,
  loading,
  gesperrt,
  blockDauer,
  wechselzeit,
  startZeit,
  fensterEnde,
  postenVormittag,
  mittagAktiv,
  mittag,
  antiKorr,
  quickTeamCount,
  onBlockDauerChange,
  onWechselzeitChange,
  onStartZeitChange,
  onFensterEndeChange,
  onPostenVormittagChange,
  onMittagAktivChange,
  onMittagChange,
  onAntiKorrChange,
  onQuickTeamCountChange,
  onGenerateQuickTeams,
}: KonfigurationPanelProps) {
  const readyGames = games.filter(
    (g) => g.status === "BEREIT" || g.status === "AKTIV"
  );
  const postenProTeam = readyGames.reduce((s, g) => s + g.durchgaenge, 0);
  const takt = blockDauer + wechselzeit;
  const runden = mindestRunden(teams.length, readyGames);
  const dauerMin = runden > 0 ? runden * takt - wechselzeit : 0;

  const start = parseZeit(startZeit);
  const ende = parseZeit(fensterEnde);
  const fensterMin = Number.isFinite(start) && Number.isFinite(ende) ? ende - start : NaN;
  const passtNicht = Number.isFinite(fensterMin) && dauerMin > fensterMin;

  return (
    <section className="rounded-[10px] border border-line bg-surface p-5">
      {/* fieldset: sperrt im Gameday alle Eingaben in einem Zug */}
      <fieldset disabled={gesperrt} className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="cg-label">Konfiguration</h2>
          {gesperrt && (
            <span className="text-[11px] text-warn">
              Gameday l&auml;uft &mdash; schreibgesch&uuml;tzt
            </span>
          )}
        </div>

        {/* Turnierfenster */}
        <div className="space-y-3 rounded-[10px] border border-line p-4">
          <h3 className="text-[13px] font-semibold text-ink">Turnierfenster</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Feld label="Start">
              <input
                type="time"
                value={startZeit}
                onChange={(e) => onStartZeitChange(e.target.value)}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Ende (spätestens)">
              <input
                type="time"
                value={fensterEnde}
                onChange={(e) => onFensterEndeChange(e.target.value)}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Blockdauer (min)">
              <input
                type="number"
                min={1}
                value={blockDauer}
                onChange={(e) => onBlockDauerChange(parseInt(e.target.value) || 15)}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Wechselzeit (min)">
              <input
                type="number"
                min={0}
                value={wechselzeit}
                onChange={(e) => onWechselzeitChange(parseInt(e.target.value) || 0)}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Takt">
              <div className="tnum flex h-[38px] items-center rounded-[9px] border border-line bg-sunken px-3 text-sm text-ink-3">
                {takt} min
              </div>
            </Feld>
          </div>

          <Hochrechnung
            teams={teams.length}
            postenProTeam={postenProTeam}
            runden={runden}
            dauerMin={dauerMin}
            fensterMin={fensterMin}
            passtNicht={passtNicht}
          />
        </div>

        {/* Mittagsfenster */}
        <MittagsfensterSection
          aktiv={mittagAktiv}
          mittag={mittag}
          teamsCount={teams.length}
          postenCount={readyGames.length}
          onAktivChange={onMittagAktivChange}
          onChange={onMittagChange}
        />

        {/* Verteilung über den Tag */}
        <div className="space-y-3 rounded-[10px] border border-line p-4">
          <h3 className="text-[13px] font-semibold text-ink">Verteilung über den Tag</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Feld label="Posten vor dem Mittag">
              <input
                type="number"
                min={1}
                max={Math.max(1, postenProTeam - 1)}
                value={postenVormittag ?? ""}
                placeholder={`Automatik (${Math.round(postenProTeam * 0.6)})`}
                onChange={(e) =>
                  onPostenVormittagChange(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <div className="sm:col-span-2">
              <p className="text-[11px] leading-relaxed text-ink-3">
                Ziel, wie viele der <span className="tnum">{postenProTeam}</span>{" "}
                Posten ein Team vor seiner eigenen Mittagswelle absolviert. Der
                Rest liegt am Nachmittag. Je nach Team weicht das um ein bis zwei
                Posten ab &mdash; die Engine gibt der Machbarkeit den Vorrang.
                Leer lassen f&uuml;r Automatik (rund 60 %).
              </p>
            </div>
          </div>
        </div>

        {/* Anti-Korrelation */}
        <AntiKorrelationSection
          antiKorr={antiKorr}
          games={games}
          onAntiKorrChange={onAntiKorrChange}
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
          <span>
            Posten pro Team:{" "}
            <strong className="tnum font-semibold text-ink">{postenProTeam}</strong>
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
          <Warnkasten>
            Keine Games auf &quot;Bereit&quot; gesetzt. Geh zur Game-Verwaltung und
            setze den Status mindestens eines Games auf &quot;Bereit&quot;.
          </Warnkasten>
        )}
      </fieldset>
    </section>
  );
}

// ─── Bausteine ───────────────────────────────────────────────────────

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="cg-label">{label}</label>
      {children}
    </div>
  );
}

function Warnkasten({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-2.5 text-[13px] text-ink-2">
      <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-warn" />
      <span>{children}</span>
    </div>
  );
}

function Hochrechnung({
  teams,
  postenProTeam,
  runden,
  dauerMin,
  fensterMin,
  passtNicht,
}: {
  teams: number;
  postenProTeam: number;
  runden: number;
  dauerMin: number;
  fensterMin: number;
  passtNicht: boolean;
}) {
  if (teams === 0 || postenProTeam === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-3">
        <Info size={13} weight="bold" className="mt-0.5 shrink-0" />
        <span>
          <span className="tnum">{teams}</span> Teams &times;{" "}
          <span className="tnum">{postenProTeam}</span> Posten brauchen mindestens{" "}
          <span className="tnum font-semibold text-ink-2">{runden}</span> Runden ={" "}
          <span className="tnum font-semibold text-ink-2">{formatDauer(dauerMin)}</span>{" "}
          reine Spielzeit
          {Number.isFinite(fensterMin) && (
            <>
              {" "}
              &mdash; Fenster:{" "}
              <span className="tnum">{formatDauer(Math.max(0, fensterMin))}</span>
            </>
          )}
          . Jedes Team hat die restlichen Runden frei und kann zuschauen.
        </span>
      </p>
      {passtNicht && (
        <Warnkasten>
          Der Tag passt so nicht ins Fenster. Blockdauer oder Wechselzeit
          k&uuml;rzen, Durchg&auml;nge reduzieren oder das Fenster erweitern.
        </Warnkasten>
      )}
    </div>
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
        checked ? "border-action bg-action" : "border-line-strong bg-sunken"
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

function MittagsfensterSection({
  aktiv,
  mittag,
  teamsCount,
  postenCount,
  onAktivChange,
  onChange,
}: {
  aktiv: boolean;
  mittag: MittagsfensterParameter;
  teamsCount: number;
  postenCount: number;
  onAktivChange: (val: boolean) => void;
  onChange: (update: Partial<MittagsfensterParameter>) => void;
}) {
  const von = parseZeit(mittag.von);
  const bis = parseZeit(mittag.bis);
  const spielraum = bis - von - mittag.dauerMin;
  const passenWellen =
    Number.isFinite(spielraum) && spielraum >= 0
      ? mittag.versatzMin > 0
        ? Math.floor(spielraum / mittag.versatzMin) + 1
        : 1
      : 0;
  const gewuenschteWellen = Math.max(
    1,
    Math.ceil(teamsCount / Math.max(1, mittag.teamsProWelle)),
  );
  const wellen = Math.min(gewuenschteWellen, Math.max(1, passenWellen));
  const teamsProWelleEffektiv = Math.ceil(teamsCount / wellen);
  const zuEng = passenWellen > 0 && gewuenschteWellen > passenWellen;

  return (
    <div className="space-y-4 rounded-[10px] border border-line p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">Mittagsfenster</h3>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-ink-3">{aktiv ? "Aktiv" : "Aus"}</span>
          <Switch
            checked={aktiv}
            onToggle={() => onAktivChange(!aktiv)}
            label="Mittagsfenster"
          />
        </div>
      </div>

      {aktiv && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Feld label="Ab">
              <input
                type="time"
                value={mittag.von}
                onChange={(e) => onChange({ von: e.target.value })}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Bis">
              <input
                type="time"
                value={mittag.bis}
                onChange={(e) => onChange({ bis: e.target.value })}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Essenszeit (min)">
              <input
                type="number"
                min={5}
                step={5}
                value={mittag.dauerMin}
                onChange={(e) => onChange({ dauerMin: parseInt(e.target.value) || 30 })}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Teams pro Welle">
              <input
                type="number"
                min={1}
                value={mittag.teamsProWelle}
                onChange={(e) =>
                  onChange({ teamsProWelle: parseInt(e.target.value) || 3 })
                }
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
            <Feld label="Versatz (min)">
              <input
                type="number"
                min={0}
                step={5}
                value={mittag.versatzMin}
                onChange={(e) => onChange({ versatzMin: parseInt(e.target.value) || 10 })}
                className={`${INPUT_CLASS} tnum`}
              />
            </Feld>
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-3">
            <Info size={13} weight="bold" className="mt-0.5 shrink-0" />
            <span>
              Der Betrieb l&auml;uft weiter: Teams essen in Wellen, wenn sie frei
              sind. Bei <span className="tnum">{teamsCount}</span> Teams ergibt das{" "}
              <span className="tnum font-semibold text-ink-2">{wellen}</span> Wellen
              zu je bis zu{" "}
              <span className="tnum font-semibold text-ink-2">
                {teamsProWelleEffektiv}
              </span>{" "}
              Teams, alle <span className="tnum">{mittag.versatzMin}</span> min eine.
              Die <span className="tnum">{postenCount}</span> Posten pausieren
              gestaffelt in denselben Wellen, damit ihre Crew essen kann.
            </span>
          </p>

          {passenWellen === 0 && (
            <Warnkasten>
              Das Fenster {mittag.von}&ndash;{mittag.bis} ist k&uuml;rzer als die
              Essenszeit von {mittag.dauerMin} min.
            </Warnkasten>
          )}

          {zuEng && (
            <Warnkasten>
              Ins Fenster passen nur {passenWellen} Wellen &mdash; es essen dann bis
              zu {teamsProWelleEffektiv} Teams gleichzeitig. Fenster verl&auml;ngern
              oder Versatz verkleinern, wenn die K&uuml;che das nicht tr&auml;gt.
            </Warnkasten>
          )}
        </>
      )}
    </div>
  );
}

function AntiKorrelationSection({
  antiKorr,
  games,
  onAntiKorrChange,
}: {
  antiKorr: AntiKorrConfig;
  games: Game[];
  onAntiKorrChange: (update: Partial<AntiKorrConfig>) => void;
}) {
  const { antiKorrAktiv, antiKorrGameX, antiKorrGameY } = antiKorr;
  const gleichesGame = antiKorrGameX !== "" && antiKorrGameX === antiKorrGameY;
  const istBereit = (g: Game) => g.status === "BEREIT" || g.status === "AKTIV";

  // Die Generate-Route akzeptiert nur Paare aus BEREIT/AKTIV-Games — ein
  // nicht-bereites Paar wird beim Generieren/Speichern ignoriert (page.tsx).
  const gewaehlteGames = [antiKorrGameX, antiKorrGameY]
    .filter((id) => id !== "")
    .map((id) => games.find((g) => g.id === id))
    .filter((g): g is Game => g !== undefined);
  const nichtBereiteNamen = gewaehlteGames
    .filter((g) => !istBereit(g))
    .map((g) => g.name);
  const paarNichtBereit = !gleichesGame && nichtBereiteNamen.length > 0;

  const gameSelect = (
    label: string,
    value: string,
    field: "antiKorrGameX" | "antiKorrGameY",
  ) => (
    <Feld label={label}>
      <select
        value={value}
        onChange={(e) => onAntiKorrChange({ [field]: e.target.value })}
        className={INPUT_CLASS}
      >
        <option value="">Game w&auml;hlen...</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
            {istBereit(g) ? "" : " (nicht bereit)"}
          </option>
        ))}
      </select>
    </Feld>
  );

  return (
    <div className="space-y-4 rounded-[10px] border border-line p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">Anti-Korrelation</h3>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-ink-3">
            {antiKorrAktiv ? "Aktiv" : "Aus"}
          </span>
          <Switch
            checked={antiKorrAktiv}
            onToggle={() => onAntiKorrChange({ antiKorrAktiv: !antiKorrAktiv })}
            label="Anti-Korrelation"
          />
        </div>
      </div>
      {antiKorrAktiv && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {gameSelect("Game A", antiKorrGameX, "antiKorrGameX")}
            {gameSelect("Game B", antiKorrGameY, "antiKorrGameY")}
          </div>
          <p className="text-[11px] text-ink-3">
            Ein Team, das Game A fr&uuml;h spielt, spielt Game B sp&auml;t &ndash;
            und umgekehrt. Gleicht den Beobachtungsvorteil sp&auml;ter Slots
            zwischen den beiden Games aus.
          </p>
          {gleichesGame && (
            <Warnkasten>
              Game A und Game B sind identisch. W&auml;hle zwei unterschiedliche
              Games, sonst wird die Anti-Korrelation bei der Generierung ignoriert.
            </Warnkasten>
          )}
          {paarNichtBereit && (
            <Warnkasten>
              {nichtBereiteNamen.join(" und ")}{" "}
              {nichtBereiteNamen.length === 1 ? "ist" : "sind"} nicht auf
              &quot;Bereit&quot; oder &quot;Aktiv&quot;. Das Paar wird bei der
              Generierung ignoriert, bis beide Games bereit sind.
            </Warnkasten>
          )}
        </>
      )}
    </div>
  );
}
