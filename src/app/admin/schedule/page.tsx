"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowsClockwise, Lightning, Warning } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { HotPill, StatusPill } from "@/components/ui/pills";
import { parameterDiff, type ZeitplanParameter } from "@/lib/zeitplan-parameter";
import { MITTAG_DEFAULT } from "@/lib/mittagsplanung";
import { apiFetch, apiSend, aufDatenAenderung } from "@/lib/api-client";
import { meldung } from "@/lib/api-fehler";
import {
  Team,
  Game,
  GamedayStatus,
  GeladenerZeitplan,
  MittagsfensterParameter,
  ScheduleResult,
  SavedConfig,
} from "./types";
import { GespeicherteZeitplaene } from "./GespeicherteZeitplaene";
import { KonfigurationPanel } from "./KonfigurationPanel";
import { ZeitplanAktionen } from "./ZeitplanAktionen";
import { ZeitplanErgebnis } from "./ZeitplanErgebnis";

const FENSTER_ENDE_DEFAULT = "16:30";

export default function SchedulePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"matrix" | "team">("matrix");
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  // Frisch generiert? (>0 = Zeitstempel der letzten Generierung, 0 = geladen)
  const [genStamp, setGenStamp] = useState(0);
  /** Ergebnis stammt aus einer Vorschau und ist noch nicht gespeichert. */
  const [istVorschau, setIstVorschau] = useState(false);

  // Gespeicherte Zeitplaene
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [geladen, setGeladen] = useState<GeladenerZeitplan | null>(null);
  const [saveName, setSaveName] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Gameday sperrt den Zeitplan am laufenden Tag
  const [gamedayModus, setGamedayModus] = useState("INAKTIV");
  const gesperrt = gamedayModus === "TEST" || gamedayModus === "HOT";

  // Turnierfenster und Takt
  const [blockDauer, setBlockDauer] = useState(15);
  const [wechselzeit, setWechselzeit] = useState(5);
  const [startZeit, setStartZeit] = useState("09:00");
  const [fensterEnde, setFensterEnde] = useState(FENSTER_ENDE_DEFAULT);
  const [postenVormittag, setPostenVormittag] = useState<number | null>(null);

  // Mittagsfenster (rollend, keine globale Pause)
  const [mittagAktiv, setMittagAktiv] = useState(true);
  const [mittag, setMittag] = useState<MittagsfensterParameter>(MITTAG_DEFAULT);

  // Anti-Korrelation (Spielregeln-Protokoll: Kisten stapeln <-> Stack Attack)
  const [antiKorrAktiv, setAntiKorrAktiv] = useState(false);
  const [antiKorrGameX, setAntiKorrGameX] = useState("");
  const [antiKorrGameY, setAntiKorrGameY] = useState("");

  // Quick team generator
  const [quickTeamCount, setQuickTeamCount] = useState(16);

  const readyGames = games.filter(
    (g) => g.status === "BEREIT" || g.status === "AKTIV"
  );
  const istGameBereit = (id: string) => readyGames.some((g) => g.id === id);

  // Gültiges Anti-Korrelations-Paar für Generate/Save. Ungültige Auswahl wird
  // ignoriert statt mitgesendet — die Generate-Route akzeptiert nur Paare aus
  // BEREIT/AKTIV-Games und würde sonst mit 400 antworten.
  const antiKorrelationen =
    antiKorrAktiv &&
    antiKorrGameX &&
    antiKorrGameY &&
    antiKorrGameX !== antiKorrGameY &&
    istGameBereit(antiKorrGameX) &&
    istGameBereit(antiKorrGameY)
      ? [{ gameXId: antiKorrGameX, gameYId: antiKorrGameY }]
      : [];

  /** Parameter, wie sie gerade in der Konfiguration stehen. */
  const aktuelleParameter: ZeitplanParameter = {
    blockDauerMin: blockDauer,
    wechselzeitMin: wechselzeit,
    startZeit,
    fensterEndeZeit: fensterEnde || null,
    postenVormittag,
    mittagsfenster: mittagAktiv ? mittag : null,
  };

  const aenderungen = geladen
    ? parameterDiff(
        {
          blockDauerMin: geladen.blockDauerMin,
          wechselzeitMin: geladen.wechselzeitMin,
          startZeit: geladen.startZeit,
          fensterEndeZeit: geladen.fensterEndeZeit ?? null,
          postenVormittag: geladen.postenVormittag ?? null,
          mittagsfenster: geladen.mittagsfenster ?? null,
        },
        aktuelleParameter,
      )
    : [];

  const meldungAnzeigen = (text: string) => {
    setStatusMsg(text);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const ladeListe = useCallback(async (): Promise<SavedConfig[]> => {
    const configs = await apiFetch<SavedConfig[]>("/api/schedule", {
      fehlerText: "Fehler beim Laden der gespeicherten Zeitpläne",
    });
    setSavedConfigs(configs);
    return configs;
  }, []);

  const ladeGamedayStatus = useCallback(async () => {
    try {
      const gd = await apiFetch<GamedayStatus>("/api/gameday");
      setGamedayModus(gd.modus ?? "INAKTIV");
    } catch {
      // Sperr-Status ist nur eine Vorabprüfung — die API blockt notfalls selbst.
    }
  }, []);

  const ladeStammdaten = useCallback(async () => {
    const [t, g] = await Promise.all([
      apiFetch<Team[]>("/api/teams"),
      apiFetch<Game[]>("/api/games"),
    ]);
    setTeams(t);
    setGames(g);
    return g;
  }, []);

  /** Gespeicherten Plan laden und die Konfiguration darauf setzen. */
  const ladePlan = useCallback(async (configId: string) => {
    const data = await apiFetch<GeladenerZeitplan>("/api/schedule/" + configId, {
      fehlerText: "Fehler beim Laden des Zeitplans",
    });

    setGeladen(data);
    setResult(data);
    setIstVorschau(false);
    setGenStamp(0);
    setSaveName(data.name);
    setBlockDauer(data.blockDauerMin);
    setWechselzeit(data.wechselzeitMin);
    setStartZeit(data.startZeit);
    setFensterEnde(data.fensterEndeZeit ?? FENSTER_ENDE_DEFAULT);
    setPostenVormittag(data.postenVormittag ?? null);
    if (data.mittagsfenster) {
      setMittagAktiv(true);
      setMittag(data.mittagsfenster);
    } else {
      setMittagAktiv(false);
    }
    return data;
  }, []);

  // ── Erstaufbau: Stammdaten, Liste, Gameday-Status und aktiver Plan ──
  // Ohne dieses Nachladen wäre der Zeitplan nach jedem Reload verschwunden.
  useEffect(() => {
    let abgebrochen = false;

    (async () => {
      try {
        const g = await ladeStammdaten();
        if (abgebrochen) return;

        // Protokoll-Default: Kisten stapeln <-> Stack Attack als Anti-Korrelations-Paar.
        // Aktiviert wird nur, wenn BEIDE Games BEREIT/AKTIV sind — die
        // Generate-Route lehnt Paare mit nicht-bereiten Games mit 400 ab.
        const kisten = g.find((game) => game.slug === "kisten-stappeln");
        const stack = g.find((game) => game.slug === "stack-attack");
        if (kisten && stack) {
          setAntiKorrGameX(kisten.id);
          setAntiKorrGameY(stack.id);
          const bereit = (game: Game) =>
            game.status === "BEREIT" || game.status === "AKTIV";
          if (bereit(kisten) && bereit(stack)) setAntiKorrAktiv(true);
        }

        await ladeGamedayStatus();
        const configs = await ladeListe();
        if (abgebrochen) return;

        // Aktiver Plan zuerst, sonst der zuletzt erstellte.
        const ziel = configs.find((c) => c.istAktiv) ?? configs[0];
        if (ziel) await ladePlan(ziel.id);
      } catch (err) {
        if (!abgebrochen) setError(meldung(err, "Fehler beim Laden"));
      } finally {
        if (!abgebrochen) setInitLoading(false);
      }
    })();

    return () => {
      abgebrochen = true;
    };
  }, [ladeGamedayStatus, ladeListe, ladePlan, ladeStammdaten]);

  // Teams oder Games können in einem anderen Tab geändert worden sein — beim
  // Zurückwechseln Stammdaten und Sperr-Status auffrischen, damit die
  // Veraltet-Warnung stimmt.
  useEffect(() => {
    const auffrischen = () => {
      if (document.visibilityState !== "visible") return;
      void ladeGamedayStatus();
      void ladeStammdaten().catch(() => {});
    };
    const ab = aufDatenAenderung(auffrischen);
    window.addEventListener("focus", auffrischen);
    document.addEventListener("visibilitychange", auffrischen);
    return () => {
      ab();
      window.removeEventListener("focus", auffrischen);
      document.removeEventListener("visibilitychange", auffrischen);
    };
  }, [ladeGamedayStatus, ladeStammdaten]);

  /** Zeitplan mit den aktuellen Parametern berechnen (ohne zu speichern). */
  const generiere = (): Promise<ScheduleResult> =>
    apiSend<ScheduleResult>(
      "/api/schedule/generate",
      "POST",
      {
        blockDauerMin: blockDauer,
        wechselzeitMin: wechselzeit,
        startZeit,
        fensterEndeZeit: fensterEnde || null,
        postenVormittag,
        pausen: [],
        mittagsfenster: aktuelleParameter.mittagsfenster,
        antiKorrelationen,
      },
      "Fehler bei der Zeitplan-Generierung",
    );

  const speicherBody = (name: string, generiert: ScheduleResult) => ({
    name,
    blockDauerMin: blockDauer,
    wechselzeitMin: wechselzeit,
    startZeit,
    endZeit: generiert.endZeit,
    fensterEndeZeit: fensterEnde || null,
    postenVormittag,
    pausen: [],
    mittagsfenster: aktuelleParameter.mittagsfenster,
    mittagswellen: generiert.mittagsWellen ?? [],
    antiKorrelationen,
    slots: generiert.slots,
  });

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generiere();
      setResult(data);
      setIstVorschau(true);
      setGenStamp(Date.now());
    } catch (err) {
      setError(meldung(err));
    } finally {
      setLoading(false);
    }
  };

  /** Geladenen Plan mit den aktuellen Parametern neu aufbauen und speichern. */
  const handleAktualisieren = async () => {
    if (!geladen || !saveName.trim()) return;

    const warnungen = geladen.sperre.warnungen;
    if (warnungen.length > 0) {
      const text = [
        "Der Zeitplan wird komplett neu aufgebaut.",
        ...warnungen,
        "",
        "Fortfahren?",
      ].join("\n");
      if (!confirm(text)) return;
    }

    setLoading(true);
    setError(null);
    try {
      const generiert = await generiere();
      await apiSend(
        "/api/schedule/" + geladen.id,
        "PUT",
        { ...speicherBody(saveName, generiert), istAktiv: geladen.istAktiv },
        "Fehler beim Aktualisieren",
      );

      await ladeListe();
      await ladePlan(geladen.id);
      setGenStamp(Date.now());
      meldungAnzeigen("Zeitplan aktualisiert");
    } catch (err) {
      setError(meldung(err));
    } finally {
      setLoading(false);
    }
  };

  /** Aktuellen Stand als neuen Zeitplan ablegen. */
  const handleSpeichernNeu = async () => {
    if (!saveName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      // Immer frisch rechnen: eine ältere Vorschau könnte zu inzwischen
      // geänderten Parametern gehören — gespeichert würden dann Parameter und
      // Slots, die nicht zusammenpassen. Die Engine ist deterministisch, bei
      // unveränderten Eingaben kommt dasselbe Ergebnis heraus.
      const generiert = await generiere();
      const name =
        geladen && geladen.name === saveName.trim()
          ? `${saveName.trim()} (Kopie)`
          : saveName.trim();

      const saved = await apiSend<SavedConfig>(
        "/api/schedule",
        "POST",
        {
          ...speicherBody(name, generiert),
          // Erster Zeitplan überhaupt: direkt aktiv, damit Leitstand und
          // Einsatzplan sofort damit arbeiten.
          istAktiv: savedConfigs.length === 0,
        },
        "Fehler beim Speichern",
      );

      await ladeListe();
      await ladePlan(saved.id);
      meldungAnzeigen("Gespeichert");
    } catch (err) {
      setError(meldung(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (configId: string) => {
    setLoading(true);
    setError(null);
    try {
      await ladePlan(configId);
    } catch (err) {
      setError(meldung(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Zeitplan wirklich löschen?")) return;
    setError(null);
    try {
      await apiSend("/api/schedule/" + configId, "DELETE", undefined, "Fehler beim Löschen");

      const configs = await ladeListe();
      if (geladen?.id === configId) {
        const naechster = configs.find((c) => c.istAktiv) ?? configs[0];
        if (naechster) {
          await ladePlan(naechster.id);
        } else {
          setGeladen(null);
          setResult(null);
          setSaveName("");
        }
      }
    } catch (err) {
      setError(meldung(err));
    }
  };

  const handleSetActive = async (configId: string) => {
    setError(null);
    try {
      await apiSend(
        "/api/schedule/" + configId,
        "PUT",
        { istAktiv: true },
        "Fehler beim Aktivieren",
      );

      await ladeListe();
      if (geladen?.id === configId) await ladePlan(configId);
      else setGeladen((g) => (g ? { ...g, istAktiv: false } : g));
      meldungAnzeigen("Aktiviert");
    } catch (err) {
      setError(meldung(err));
    }
  };

  const generateQuickTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      for (let i = 1; i <= quickTeamCount; i++) {
        await apiSend("/api/teams", "POST", { name: `Team ${i}`, nummer: i });
      }
      await ladeStammdaten();
    } catch (err) {
      setError(meldung(err, "Fehler beim Erstellen der Teams"));
    } finally {
      setLoading(false);
    }
  };

  const handleAntiKorrChange = (update: Partial<{
    antiKorrAktiv: boolean;
    antiKorrGameX: string;
    antiKorrGameY: string;
  }>) => {
    if (update.antiKorrAktiv !== undefined) setAntiKorrAktiv(update.antiKorrAktiv);
    if (update.antiKorrGameX !== undefined) setAntiKorrGameX(update.antiKorrGameX);
    if (update.antiKorrGameY !== undefined) setAntiKorrGameY(update.antiKorrGameY);
  };

  const aktiveConfig = savedConfigs.find((c) => c.istAktiv);
  const veraltet = geladen?.aktualitaet && !geladen.aktualitaet.aktuell;

  return (
    <div className="flex flex-col">
      <TopBar title="Zeitplan">
        {gamedayModus === "HOT" ? (
          <HotPill />
        ) : gamedayModus === "TEST" ? (
          <StatusPill tone="action">TEST</StatusPill>
        ) : null}
        <span className="hidden text-[13px] text-ink-3 md:inline">
          {aktiveConfig ? (
            <>
              Aktiv:{" "}
              <span className="font-medium text-ink-2">{aktiveConfig.name}</span>
            </>
          ) : (
            "Kein aktiver Zeitplan"
          )}
        </span>
        <TopBarSpacer />
        <Button
          variant="ghost"
          onClick={handleGenerate}
          disabled={
            loading || gesperrt || teams.length === 0 || readyGames.length === 0
          }
          title={
            gesperrt ? "Gameday läuft — Zeitplan gesperrt" : "Vorschau berechnen"
          }
        >
          <Lightning size={15} weight="bold" />
          {loading ? "Generiert..." : "Vorschau generieren"}
        </Button>
      </TopBar>

      <div className="space-y-5 px-4 py-6 sm:px-[22px]">
        {gesperrt && (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-2.5 text-[13px] text-ink-2">
            <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-warn" />
            <span>
              Gameday l&auml;uft ({gamedayModus}) &mdash; der Zeitplan ist
              gesperrt. Einsatzplan, Zeitachse und QR-Verifikationen h&auml;ngen
              an den bestehenden Slots. Beende den Gameday im Leitstand, um den
              Zeitplan wieder zu &auml;ndern.
            </span>
          </div>
        )}

        {veraltet && !gesperrt && (
          <VeraltetBanner
            abweichungen={geladen!.aktualitaet.abweichungen}
            loading={loading}
            onAktualisieren={handleAktualisieren}
          />
        )}

        {error && (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--hot-border)] bg-hot-dim/50 px-3.5 py-2.5 text-[13px] text-ink-2">
            <Warning
              size={15}
              weight="bold"
              className="mt-0.5 shrink-0 text-hot-tint"
            />
            <span>{error}</span>
          </div>
        )}

        {initLoading ? (
          <p className="text-sm text-ink-3">Lade Zeitpl&auml;ne&hellip;</p>
        ) : (
          <>
            <GespeicherteZeitplaene
              configs={savedConfigs}
              loadedConfigId={geladen?.id ?? null}
              gesperrt={gesperrt}
              onLoad={handleLoad}
              onDelete={handleDelete}
              onSetActive={handleSetActive}
            />

            <KonfigurationPanel
              teams={teams}
              games={games}
              loading={loading}
              gesperrt={gesperrt}
              blockDauer={blockDauer}
              wechselzeit={wechselzeit}
              startZeit={startZeit}
              fensterEnde={fensterEnde}
              postenVormittag={postenVormittag}
              mittagAktiv={mittagAktiv}
              mittag={mittag}
              antiKorr={{ antiKorrAktiv, antiKorrGameX, antiKorrGameY }}
              quickTeamCount={quickTeamCount}
              onBlockDauerChange={setBlockDauer}
              onWechselzeitChange={setWechselzeit}
              onStartZeitChange={setStartZeit}
              onFensterEndeChange={setFensterEnde}
              onPostenVormittagChange={setPostenVormittag}
              onMittagAktivChange={setMittagAktiv}
              onMittagChange={(update) => setMittag((m) => ({ ...m, ...update }))}
              onAntiKorrChange={handleAntiKorrChange}
              onQuickTeamCountChange={setQuickTeamCount}
              onGenerateQuickTeams={generateQuickTeams}
            />

            {(geladen || result) && (
              <ZeitplanAktionen
                geladen={geladen}
                name={saveName}
                loading={loading}
                hatVorschau={istVorschau}
                aenderungen={aenderungen}
                gesperrt={gesperrt}
                sperrGrund={
                  gesperrt
                    ? `Gameday läuft (${gamedayModus}) — der Zeitplan ist gesperrt.`
                    : null
                }
                statusMsg={statusMsg}
                onNameChange={setSaveName}
                onAktualisieren={handleAktualisieren}
                onSpeichernNeu={handleSpeichernNeu}
                onAktivieren={() => geladen && handleSetActive(geladen.id)}
              />
            )}

            {result && (
              <ZeitplanErgebnis
                key={genStamp}
                animate={genStamp > 0}
                result={result}
                teams={teams}
                viewMode={viewMode}
                selectedTeam={selectedTeam}
                onViewModeChange={setViewMode}
                onSelectedTeamChange={setSelectedTeam}
              />
            )}

            {!result && savedConfigs.length === 0 && (
              <p className="rounded-[10px] border border-line bg-surface px-4 py-8 text-center text-sm text-ink-3">
                Noch kein Zeitplan vorhanden. Parameter einstellen,
                &quot;Vorschau generieren&quot; und anschliessend speichern.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Der gespeicherte Plan passt nicht mehr zu den Stammdaten — die häufigste
 * Ursache ist ein Team, das nach dem Generieren dazukam oder wegfiel.
 */
function VeraltetBanner({
  abweichungen,
  loading,
  onAktualisieren,
}: {
  abweichungen: string[];
  loading: boolean;
  onAktualisieren: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-[10px] border border-[var(--warn-border)] bg-warn-dim px-3.5 py-3">
      <Warning size={16} weight="bold" className="mt-0.5 shrink-0 text-warn" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[13px] font-semibold text-ink">
          Dieser Zeitplan ist nicht mehr aktuell
        </p>
        {abweichungen.map((a) => (
          <p key={a} className="text-[12px] text-ink-2">
            {a}
          </p>
        ))}
      </div>
      <Button variant="primary" onClick={onAktualisieren} disabled={loading}>
        <ArrowsClockwise size={15} weight="bold" />
        Neu berechnen
      </Button>
    </div>
  );
}
