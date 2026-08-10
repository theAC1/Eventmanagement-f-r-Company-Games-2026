"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightning, Warning } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { HotPill, StatusPill } from "@/components/ui/pills";
import { parameterDiff, type ZeitplanParameter } from "@/lib/zeitplan-parameter";
import {
  Team,
  Game,
  GamedayStatus,
  GeladenerZeitplan,
  ScheduleResult,
  SavedConfig,
} from "./types";
import { GespeicherteZeitplaene } from "./GespeicherteZeitplaene";
import { KonfigurationPanel } from "./KonfigurationPanel";
import { ZeitplanAktionen } from "./ZeitplanAktionen";
import { ZeitplanErgebnis } from "./ZeitplanErgebnis";

type ApiFehler = {
  error?: string;
  details?: { field?: string; message?: string }[];
};

/** Extrahiert den Klartext-Grund (error + Zod-details) aus einer API-Fehlerantwort. */
function fehlerText(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const { error, details } = data as ApiFehler;
    const detailText = Array.isArray(details)
      ? details
          .map((d) => (d.field ? `${d.field}: ${d.message ?? ""}` : d.message ?? ""))
          .filter((t) => t.length > 0)
          .join("; ")
      : "";
    if (error && detailText) return `${error} — ${detailText}`;
    if (error) return error;
    if (detailText) return detailText;
  }
  return fallback;
}

async function jsonOderFehler(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(fehlerText(data, fallback));
  return data;
}

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

  // Config
  const [blockDauer, setBlockDauer] = useState(15);
  const [wechselzeit, setWechselzeit] = useState(5);
  const [startZeit, setStartZeit] = useState("09:00");

  // Mittagspause
  const [mittagAktiv, setMittagAktiv] = useState(true);
  const [mittagNachRunde, setMittagNachRunde] = useState(6);
  const [mittagDauer, setMittagDauer] = useState(45);
  const [mittagMaxTeams, setMittagMaxTeams] = useState(8);
  const [mittagVersatz, setMittagVersatz] = useState(5);

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
  // BEREIT/AKTIV-Games und würde sonst mit 400 antworten (Warnhinweis dazu
  // zeigt die Anti-Korrelations-Sektion im KonfigurationPanel).
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
    mittagspause: mittagAktiv
      ? {
          nachRunde: mittagNachRunde,
          dauerMin: mittagDauer,
          maxTeamsGleichzeitig: mittagMaxTeams,
          versatzMin: mittagVersatz,
        }
      : null,
  };

  const aenderungen = geladen
    ? parameterDiff(
        {
          blockDauerMin: geladen.blockDauerMin,
          wechselzeitMin: geladen.wechselzeitMin,
          startZeit: geladen.startZeit,
          mittagspause: geladen.mittagspause ?? null,
        },
        aktuelleParameter,
      )
    : [];

  const meldung = (text: string) => {
    setStatusMsg(text);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const ladeListe = useCallback(async (): Promise<SavedConfig[]> => {
    const res = await fetch("/api/schedule");
    const configs: SavedConfig[] = await jsonOderFehler(
      res,
      "Fehler beim Laden der gespeicherten Zeitpläne",
    );
    setSavedConfigs(configs);
    return configs;
  }, []);

  const ladeGamedayStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/gameday");
      const gd: GamedayStatus = await jsonOderFehler(
        res,
        "Gameday-Status nicht verfügbar",
      );
      setGamedayModus(gd.modus ?? "INAKTIV");
    } catch {
      // Sperr-Status ist nur eine Vorabprüfung — die API blockt notfalls selbst.
    }
  }, []);

  /** Gespeicherten Plan laden und die Konfiguration darauf setzen. */
  const ladePlan = useCallback(async (configId: string) => {
    const res = await fetch("/api/schedule/" + configId);
    const data: GeladenerZeitplan = await jsonOderFehler(
      res,
      "Fehler beim Laden des Zeitplans",
    );

    setGeladen(data);
    setResult(data);
    setIstVorschau(false);
    setGenStamp(0);
    setSaveName(data.name);
    setBlockDauer(data.blockDauerMin);
    setWechselzeit(data.wechselzeitMin);
    setStartZeit(data.startZeit);
    if (data.mittagspause) {
      setMittagAktiv(true);
      setMittagNachRunde(data.mittagspause.nachRunde);
      setMittagDauer(data.mittagspause.dauerMin);
      setMittagMaxTeams(data.mittagspause.maxTeamsGleichzeitig);
      setMittagVersatz(data.mittagspause.versatzMin);
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
        const [t, g] = await Promise.all([
          fetch("/api/teams").then((r) => r.json()) as Promise<Team[]>,
          fetch("/api/games").then((r) => r.json()) as Promise<Game[]>,
        ]);
        if (abgebrochen) return;
        setTeams(t);
        setGames(g);

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
        if (!abgebrochen) {
          setError(err instanceof Error ? err.message : "Fehler beim Laden");
        }
      } finally {
        if (!abgebrochen) setInitLoading(false);
      }
    })();

    return () => {
      abgebrochen = true;
    };
  }, [ladeGamedayStatus, ladeListe, ladePlan]);

  // Gameday kann in einem anderen Tab gestartet werden — beim Zurückwechseln
  // den Sperr-Status auffrischen, damit die Buttons nicht falsch offen sind.
  useEffect(() => {
    const auffrischen = () => {
      if (document.visibilityState === "visible") void ladeGamedayStatus();
    };
    window.addEventListener("focus", auffrischen);
    document.addEventListener("visibilitychange", auffrischen);
    return () => {
      window.removeEventListener("focus", auffrischen);
      document.removeEventListener("visibilitychange", auffrischen);
    };
  }, [ladeGamedayStatus]);

  /** Zeitplan mit den aktuellen Parametern berechnen (ohne zu speichern). */
  const generiere = async (): Promise<ScheduleResult> => {
    const res = await fetch("/api/schedule/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockDauerMin: blockDauer,
        wechselzeitMin: wechselzeit,
        startZeit,
        pausen: [],
        mittagspause: aktuelleParameter.mittagspause ?? undefined,
        antiKorrelationen,
      }),
    });
    return jsonOderFehler(res, "Fehler bei der Zeitplan-Generierung");
  };

  const speicherBody = (name: string, generiert: ScheduleResult) => ({
    name,
    blockDauerMin: blockDauer,
    wechselzeitMin: wechselzeit,
    startZeit,
    endZeit: generiert.endZeit,
    pausen: [],
    mittagspause: aktuelleParameter.mittagspause,
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
      setError(err instanceof Error ? err.message : "Fehler");
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
      const res = await fetch("/api/schedule/" + geladen.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...speicherBody(saveName, generiert),
          istAktiv: geladen.istAktiv,
        }),
      });
      await jsonOderFehler(res, "Fehler beim Aktualisieren");

      await ladeListe();
      await ladePlan(geladen.id);
      // Mittagsschichten berechnet nur die Engine — sie stehen nicht in der DB
      // und würden sonst direkt nach dem Aktualisieren verschwinden.
      setResult((r) =>
        r ? { ...r, mittagsSchichten: generiert.mittagsSchichten } : r,
      );
      setGenStamp(Date.now());
      meldung("Zeitplan aktualisiert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
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

      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...speicherBody(name, generiert),
          // Erster Zeitplan überhaupt: direkt aktiv, damit Leitstand und
          // Einsatzplan sofort damit arbeiten.
          istAktiv: savedConfigs.length === 0,
        }),
      });
      const saved: SavedConfig = await jsonOderFehler(res, "Fehler beim Speichern");

      await ladeListe();
      await ladePlan(saved.id);
      setResult((r) =>
        r ? { ...r, mittagsSchichten: generiert.mittagsSchichten } : r,
      );
      meldung("Gespeichert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
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
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Zeitplan wirklich löschen?")) return;
    setError(null);
    try {
      const res = await fetch("/api/schedule/" + configId, { method: "DELETE" });
      await jsonOderFehler(res, "Fehler beim Löschen");

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
      setError(err instanceof Error ? err.message : "Fehler");
    }
  };

  const handleSetActive = async (configId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/schedule/" + configId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ istAktiv: true }),
      });
      await jsonOderFehler(res, "Fehler beim Aktivieren");

      await ladeListe();
      if (geladen?.id === configId) await ladePlan(configId);
      else setGeladen((g) => (g ? { ...g, istAktiv: false } : g));
      meldung("Aktiviert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    }
  };

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

  const handleMittagChange = (update: Partial<{
    mittagAktiv: boolean;
    mittagNachRunde: number;
    mittagDauer: number;
    mittagMaxTeams: number;
    mittagVersatz: number;
  }>) => {
    if (update.mittagAktiv !== undefined) setMittagAktiv(update.mittagAktiv);
    if (update.mittagNachRunde !== undefined) setMittagNachRunde(update.mittagNachRunde);
    if (update.mittagDauer !== undefined) setMittagDauer(update.mittagDauer);
    if (update.mittagMaxTeams !== undefined) setMittagMaxTeams(update.mittagMaxTeams);
    if (update.mittagVersatz !== undefined) setMittagVersatz(update.mittagVersatz);
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
              mittag={{ mittagAktiv, mittagNachRunde, mittagDauer, mittagMaxTeams, mittagVersatz }}
              antiKorr={{ antiKorrAktiv, antiKorrGameX, antiKorrGameY }}
              quickTeamCount={quickTeamCount}
              onBlockDauerChange={setBlockDauer}
              onWechselzeitChange={setWechselzeit}
              onStartZeitChange={setStartZeit}
              onMittagChange={handleMittagChange}
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
