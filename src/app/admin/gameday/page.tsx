"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowSquareOut, DownloadSimple } from "@phosphor-icons/react";
import { TopBar, TopBarDivider, TopBarSpacer } from "@/components/ui/top-bar";
import { HotPill, StatusPill } from "@/components/ui/pills";
import { Button, ButtonLink } from "@/components/ui/button";
import { GamedayControls } from "./components/gameday-controls";
import { TabBar } from "./components/tab-bar";
import { UebersichtTab } from "./components/uebersicht-tab";
import { ZeitachseTab } from "./components/zeitachse-tab";
import { AktivitaetTab } from "./components/aktivitaet-tab";
import { KorrekturenTab } from "./components/korrekturen-tab";
import { DemoSeed } from "./components/demo-seed";

type RanglisteEntry = {
  teamId: string; teamName: string; rangPunkteSumme: number;
  gamesGespielt: number; gamesTotal: number; gesamtRang: number;
};

type GameErgebnis = {
  id: string; gamePunkte: number | null; rangImGame: number | null;
  status: string; eingetragenUm: string | null;
  game: { id: string; name: string; slug: string };
  team: { id: string; name: string; nummer: number };
};

type GameInfo = {
  id: string; name: string; slug: string; modus: string; status: string;
};

type TeamInfo = {
  id: string; name: string; nummer: number;
};

/** Live-Uhr in der Topbar — Aktualisierung pro Minute reicht (Polling läuft separat). */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  return now.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function ModusPill({ modus }: { modus: string }) {
  if (modus === "HOT") return <HotPill />;
  if (modus === "TEST") return <StatusPill tone="action">TEST</StatusPill>;
  return <StatusPill tone="neutral">INAKTIV</StatusPill>;
}

function ExportMenu() {
  return (
    <div className="group relative">
      <Button variant="ghost" aria-haspopup="menu">
        <DownloadSimple size={14} weight="bold" />
        Export
      </Button>
      <div
        role="menu"
        className="invisible absolute right-0 top-full z-50 mt-1 w-48 rounded-[10px] border border-line bg-surface py-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        style={{ boxShadow: "var(--shadow-pop)" }}
      >
        <button
          type="button"
          onClick={() => window.open("/api/export/rangliste", "_blank")}
          className="w-full px-3 py-2 text-left text-[13px] text-ink-2 transition-colors duration-150 hover:bg-sunken"
        >
          Rangliste CSV
        </button>
        <button
          type="button"
          onClick={() => window.open("/api/export/ergebnisse", "_blank")}
          className="w-full px-3 py-2 text-left text-[13px] text-ink-2 transition-colors duration-150 hover:bg-sunken"
        >
          Ergebnisse CSV
        </button>
        <button
          type="button"
          onClick={() => window.open("/api/export/teams", "_blank")}
          className="w-full px-3 py-2 text-left text-[13px] text-ink-2 transition-colors duration-150 hover:bg-sunken"
        >
          Teams CSV
        </button>
        <div className="my-1 border-t border-line" />
        <button
          type="button"
          onClick={() => window.open("/admin/gameday/print", "_blank")}
          className="w-full px-3 py-2 text-left text-[13px] text-ink-3 transition-colors duration-150 hover:bg-sunken"
        >
          Druckansicht
        </button>
      </div>
    </div>
  );
}

export default function GamedayDashboard() {
  const [activeTab, setActiveTab] = useState("uebersicht");
  const [rangliste, setRangliste] = useState<RanglisteEntry[]>([]);
  const [ergebnisse, setErgebnisse] = useState<GameErgebnis[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [gamedayModus, setGamedayModus] = useState<string>("INAKTIV");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [aktivitaetGameFilter, setAktivitaetGameFilter] = useState<string>("");
  const activeTabRef = useRef(activeTab);
  const clock = useClock();

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const loadData = useCallback(() => {
    Promise.all([
      fetch("/api/rangliste").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/ergebnisse").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/games").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/teams").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/gameday").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([rang, erg, g, t, gd]) => {
        setRangliste(rang.rangliste ?? []);
        setErgebnisse(Array.isArray(erg) ? erg : []);
        setGames(
          (Array.isArray(g) ? g : []).filter(
            (x: GameInfo) => x.status === "BEREIT" || x.status === "AKTIV",
          ),
        );
        setTeams(Array.isArray(t) ? t : []);
        setGamedayModus(gd.modus ?? "INAKTIV");
        setFetchError(null);
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(`Verbindung fehlgeschlagen: ${err.message}`);
        setLoading(false);
      });
  }, []);

  // Initial load + auto-refresh only on uebersicht tab
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (activeTabRef.current === "uebersicht") {
        loadData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  /** Aus der Zeitachse heraus: Aktivität-Tab mit Game-Filter öffnen. */
  const handleInspectGame = useCallback((gameId: string) => {
    setAktivitaetGameFilter(gameId);
    setActiveTab("aktivitaet");
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade Leitstand…
      </div>
    );
  }

  if (fetchError && rangliste.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-hot-tint">{fetchError}</p>
        <Button variant="ghost" onClick={loadData}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Leitstand">
        <ModusPill modus={gamedayModus} />
        <span className="hidden text-xs text-ink-3 md:block">
          <span className="tnum">{games.length}</span> Stationen ·{" "}
          <span className="tnum">{teams.length}</span> Teams
        </span>
        <TopBarSpacer />
        <span className="tnum text-[20px] font-semibold tracking-[0.02em] text-ink">
          {clock}
        </span>
        <span className="tnum text-[11px] text-label">AUTO 5s</span>
        <TopBarDivider />
        <ExportMenu />
        <ButtonLink variant="ghost" href="/scoreboard" target="_blank">
          <ArrowSquareOut size={14} weight="bold" />
          Scoreboard
        </ButtonLink>
      </TopBar>

      <div className="overflow-x-auto border-b border-line px-4 py-2.5 sm:px-[22px]">
        <TabBar
          activeTab={activeTab}
          onChange={(tab) => {
            // Manueller Tab-Wechsel setzt einen allfälligen Zeitachse-Filter zurück
            if (tab === "aktivitaet") setAktivitaetGameFilter("");
            setActiveTab(tab);
          }}
        />
      </div>

      <GamedayControls onStatusChange={loadData} />

      <DemoSeed onSeeded={loadData} />

      {activeTab === "uebersicht" && gamedayModus === "INAKTIV" && (
        <div className="px-4 py-10 sm:px-[22px]">
          <div className="rounded-[10px] border border-line bg-surface px-4 py-8 text-center text-sm text-ink-3">
            Starte einen Gameday um Ergebnisse zu erfassen
          </div>
        </div>
      )}

      {activeTab === "uebersicht" && gamedayModus !== "INAKTIV" && (
        <UebersichtTab
          rangliste={rangliste}
          ergebnisse={ergebnisse}
          games={games}
          fetchError={fetchError}
          onRetry={loadData}
        />
      )}

      {activeTab === "zeitachse" && (
        <ZeitachseTab
          games={games}
          ergebnisse={ergebnisse}
          onInspectGame={handleInspectGame}
        />
      )}

      {activeTab === "aktivitaet" && (
        <AktivitaetTab
          games={games}
          teams={teams}
          initialGameFilter={aktivitaetGameFilter}
        />
      )}

      {activeTab === "korrekturen" && (
        <KorrekturenTab games={games} teams={teams} />
      )}
    </div>
  );
}
