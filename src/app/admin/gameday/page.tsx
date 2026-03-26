"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TabBar } from "./components/tab-bar";
import { UebersichtTab } from "./components/uebersicht-tab";
import { AktivitaetTab } from "./components/aktivitaet-tab";
import { KorrekturenTab } from "./components/korrekturen-tab";

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

export default function GamedayDashboard() {
  const [activeTab, setActiveTab] = useState("uebersicht");
  const [rangliste, setRangliste] = useState<RanglisteEntry[]>([]);
  const [ergebnisse, setErgebnisse] = useState<GameErgebnis[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const activeTabRef = useRef(activeTab);

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
    ])
      .then(([rang, erg, g, t]) => {
        setRangliste(rang.rangliste ?? []);
        setErgebnisse(Array.isArray(erg) ? erg : []);
        setGames(
          (Array.isArray(g) ? g : []).filter(
            (x: GameInfo) => x.status === "BEREIT" || x.status === "AKTIV",
          ),
        );
        setTeams(Array.isArray(t) ? t : []);
        setLastUpdate(new Date());
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Dashboard...
      </div>
    );
  }

  if (fetchError && rangliste.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400 text-sm">{fetchError}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gameday Live</h1>
      </div>

      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "uebersicht" && (
        <UebersichtTab
          rangliste={rangliste}
          ergebnisse={ergebnisse}
          games={games}
          lastUpdate={lastUpdate}
          fetchError={fetchError}
          onRetry={loadData}
        />
      )}

      {activeTab === "aktivitaet" && (
        <AktivitaetTab games={games} teams={teams} />
      )}

      {activeTab === "korrekturen" && (
        <KorrekturenTab games={games} teams={teams} />
      )}
    </div>
  );
}
