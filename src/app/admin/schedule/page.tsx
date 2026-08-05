"use client";

import { useState, useEffect } from "react";
import { Lightning } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { Team, Game, ScheduleResult, SavedConfig } from "./types";
import { GespeicherteZeitplaene } from "./GespeicherteZeitplaene";
import { KonfigurationPanel } from "./KonfigurationPanel";
import { SpeichernLeiste } from "./SpeichernLeiste";
import { ZeitplanErgebnis } from "./ZeitplanErgebnis";

export default function SchedulePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"matrix" | "team">("matrix");
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  // Frisch generiert? (>0 = Zeitstempel der letzten Generierung, 0 = geladen)
  const [genStamp, setGenStamp] = useState(0);

  // Gespeicherte Zeitplaene
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [loadedConfigId, setLoadedConfigId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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

  // Quick team generator
  const [quickTeamCount, setQuickTeamCount] = useState(16);

  const loadSavedConfigs = () => {
    fetch("/api/schedule").then((r) => r.json()).then(setSavedConfigs);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/games").then((r) => r.json()),
    ]).then(([t, g]) => {
      setTeams(t);
      setGames(g);
    });
    loadSavedConfigs();
  }, []);

  const handleSave = async () => {
    if (!result || !saveName.trim()) return;
    setLoading(true);
    try {
      const body = {
        name: saveName,
        blockDauerMin: blockDauer,
        wechselzeitMin: wechselzeit,
        startZeit,
        endZeit: result.endZeit,
        pausen: [],
        mittagspause: mittagAktiv ? { nachRunde: mittagNachRunde, dauerMin: mittagDauer, maxTeamsGleichzeitig: mittagMaxTeams, versatzMin: mittagVersatz } : null,
        slots: result.slots,
      };

      let res;
      if (loadedConfigId) {
        res = await fetch("/api/schedule/" + loadedConfigId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error("Fehler beim Speichern");
      const saved = await res.json();
      setLoadedConfigId(saved.id);
      setSaveMsg("Gespeichert");
      setTimeout(() => setSaveMsg(null), 2000);
      loadSavedConfigs();
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
      const res = await fetch("/api/schedule/" + configId);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setGenStamp(0);
      setResult(data);
      setLoadedConfigId(data.id);
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Zeitplan wirklich loeschen?")) return;
    await fetch("/api/schedule/" + configId, { method: "DELETE" });
    if (loadedConfigId === configId) {
      setLoadedConfigId(null);
      setResult(null);
      setSaveName("");
    }
    loadSavedConfigs();
  };

  const handleSetActive = async (configId: string) => {
    await fetch("/api/schedule/" + configId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameOnly: true, istAktiv: true, name: savedConfigs.find(c => c.id === configId)?.name }),
    });
    loadSavedConfigs();
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
          mittagspause: mittagAktiv
            ? {
                nachRunde: mittagNachRunde,
                dauerMin: mittagDauer,
                maxTeamsGleichzeitig: mittagMaxTeams,
                versatzMin: mittagVersatz,
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setGenStamp(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
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

  const readyGames = games.filter(
    (g) => g.status === "BEREIT" || g.status === "AKTIV"
  );
  const aktiveConfig = savedConfigs.find((c) => c.istAktiv);

  return (
    <div className="flex flex-col">
      <TopBar title="Zeitplan">
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
        {error && <span className="text-sm text-hot-tint">{error}</span>}
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={loading || teams.length === 0 || readyGames.length === 0}
        >
          <Lightning size={15} weight="bold" />
          {loading ? "Generiert..." : "Zeitplan generieren"}
        </Button>
      </TopBar>

      <div className="space-y-5 px-4 py-6 sm:px-[22px]">
        <GespeicherteZeitplaene
          configs={savedConfigs}
          loadedConfigId={loadedConfigId}
          onLoad={handleLoad}
          onDelete={handleDelete}
          onSetActive={handleSetActive}
        />

        <KonfigurationPanel
          teams={teams}
          games={games}
          loading={loading}
          blockDauer={blockDauer}
          wechselzeit={wechselzeit}
          startZeit={startZeit}
          mittag={{ mittagAktiv, mittagNachRunde, mittagDauer, mittagMaxTeams, mittagVersatz }}
          quickTeamCount={quickTeamCount}
          onBlockDauerChange={setBlockDauer}
          onWechselzeitChange={setWechselzeit}
          onStartZeitChange={setStartZeit}
          onMittagChange={handleMittagChange}
          onQuickTeamCountChange={setQuickTeamCount}
          onGenerateQuickTeams={generateQuickTeams}
        />

        {result && (
          <SpeichernLeiste
            saveName={saveName}
            loading={loading}
            loadedConfigId={loadedConfigId}
            saveMsg={saveMsg}
            onSaveNameChange={setSaveName}
            onSave={handleSave}
            onSaveAsNew={() => { setLoadedConfigId(null); setSaveName(""); }}
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
      </div>
    </div>
  );
}
