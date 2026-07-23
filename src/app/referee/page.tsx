"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ───

type ZeitplanConfig = {
  id: string;
  name: string;
  istAktiv: boolean;
};

type SlotData = {
  runde: number;
  startZeit: string;
  endZeit: string;
  gameId: string;
  gameName: string;
  gameSlug?: string;
  teamIds: string[];
  teamNames: string[];
  slotId?: string;
  status?: "GEPLANT" | "AKTIV" | "ABGESCHLOSSEN";
};

type ScheduleResponse = {
  id: string;
  name: string;
  slots: SlotData[];
};

type Game = {
  id: string;
  name: string;
  slug: string;
  status: string;
  modus: string;
  playtimeMin: number;
};

// ─── Helpers ───

function formatTime(zeitStr: string): string {
  // zeitStr is "HH:MM" or "HH:MM:SS"
  return zeitStr.slice(0, 5);
}

function statusBadge(status?: string) {
  switch (status) {
    case "AKTIV":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/50">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Läuft
        </span>
      );
    case "ABGESCHLOSSEN":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Fertig
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
          Geplant
        </span>
      );
  }
}

// ─── Component ───

export default function RefereePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gameday mode
  const [gamedayModus, setGamedayModus] = useState<string | null>(null);

  // Zeitplan mode
  const [zeitplanName, setZeitplanName] = useState<string | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<Map<string, SlotData[]>>(new Map());

  // Fallback mode
  const [fallbackGames, setFallbackGames] = useState<Game[] | null>(null);

  const loadData = useCallback(async () => {
    try {
      // 0. Fetch gameday status
      const gdRes = await fetch("/api/gameday");
      if (gdRes.ok) {
        const gdData = await gdRes.json();
        setGamedayModus(gdData.modus ?? "INAKTIV");

        if (gdData.modus === "INAKTIV") {
          setLoading(false);
          return;
        }
      }

      // 1. Fetch all schedule configs, find the active one
      const configsRes = await fetch("/api/schedule");
      if (!configsRes.ok) throw new Error("Zeitpläne laden fehlgeschlagen");
      const configs: ZeitplanConfig[] = await configsRes.json();
      const activeConfig = configs.find((c) => c.istAktiv);

      if (!activeConfig) {
        // No active Zeitplan → fallback to game list
        const gamesRes = await fetch("/api/games");
        if (!gamesRes.ok) throw new Error("Games laden fehlgeschlagen");
        const games: Game[] = await gamesRes.json();
        setFallbackGames(games);
        setZeitplanName(null);
        setTimeBlocks(new Map());
        setLoading(false);
        return;
      }

      // 2. Fetch slots for the active config
      const slotsRes = await fetch(`/api/schedule/${activeConfig.id}`);
      if (!slotsRes.ok) throw new Error("Zeitplan-Slots laden fehlgeschlagen");
      const scheduleData: ScheduleResponse = await slotsRes.json();

      // 3. We need the slot IDs + status — enrich from raw API
      // The schedule API returns gameName but not gameSlug or slotId, let's also fetch games for slugs
      const gamesRes = await fetch("/api/games");
      const games: Game[] = gamesRes.ok ? await gamesRes.json() : [];
      const gameSlugMap = new Map(games.map((g) => [g.id, g.slug]));

      // Fetch raw slots with IDs from the schedule endpoint
      // The schedule API already includes slot data but not the slot IDs themselves
      // We need to get the raw config with slot IDs
      const rawRes = await fetch(`/api/schedule/${activeConfig.id}`);
      const rawData = await rawRes.json();

      // Build enriched slots — the API response has slots array
      // But we need actual DB slot IDs. Let's use the raw prisma response.
      // Since /api/schedule/[id] returns transformed data without slot IDs,
      // we'll work with what we have and add gameSlug
      const enrichedSlots: SlotData[] = (rawData.slots as SlotData[]).map((s: SlotData, idx: number) => ({
        ...s,
        gameSlug: gameSlugMap.get(s.gameId) ?? s.gameId,
        slotId: (rawData as { _rawSlotIds?: string[] })._rawSlotIds?.[idx] ?? undefined,
      }));

      // 4. Group by startZeit (time blocks)
      const grouped = new Map<string, SlotData[]>();
      for (const slot of enrichedSlots) {
        const key = `${slot.startZeit}-${slot.endZeit}`;
        const existing = grouped.get(key) ?? [];
        grouped.set(key, [...existing, slot]);
      }

      setZeitplanName(scheduleData.name);
      setTimeBlocks(grouped);
      setFallbackGames(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 10s
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSlotTap = (slot: SlotData) => {
    const gameSlug = slot.gameSlug ?? slot.gameId;
    const teamIds = slot.teamIds.join(",");

    if (slot.status === "AKTIV") {
      router.push(`/referee/${gameSlug}/live?slotId=${slot.slotId ?? ""}`);
      return;
    }

    if (slot.status === "ABGESCHLOSSEN") {
      return; // no navigation
    }

    // GEPLANT → go to check-in
    const params = new URLSearchParams();
    if (slot.slotId) params.set("slotId", slot.slotId);
    if (teamIds) params.set("teams", teamIds);
    router.push(`/referee/${gameSlug}/checkin?${params.toString()}`);
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Zeitplan...
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => { setLoading(true); loadData(); }}
          className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  // ─── Gameday INAKTIV ───
  if (gamedayModus === "INAKTIV") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-zinc-400 text-sm text-center">
          Kein aktiver Gameday. Bitte warte bis die Orga den Gameday startet.
        </p>
        <button
          onClick={() => { setLoading(true); loadData(); }}
          className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
        >
          Erneut prüfen
        </button>
      </div>
    );
  }

  // ─── Gameday banner helper ───
  const gamedayBanner =
    gamedayModus === "TEST" ? (
      <div className="rounded-lg border border-blue-700 bg-blue-900/40 px-4 py-2 text-sm text-blue-300 font-medium">
        {"🔵 TEST-MODUS — Ergebnisse werden als Testdaten markiert"}
      </div>
    ) : gamedayModus === "HOT" ? (
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-900/60 text-red-300 border border-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          LIVE
        </span>
      </div>
    ) : null;

  // ─── Fallback: Game List ───
  if (fallbackGames) {
    const activeGames = fallbackGames.filter(
      (g) => g.status === "BEREIT" || g.status === "AKTIV"
    );
    const otherGames = fallbackGames.filter(
      (g) => g.status !== "BEREIT" && g.status !== "AKTIV"
    );

    return (
      <div className="space-y-6">
        {gamedayBanner}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stationen</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Kein aktiver Zeitplan — wähle deine Station
          </p>
        </div>

        {activeGames.length > 0 && (
          <div className="space-y-2">
            {activeGames.map((game) => (
              <Link
                key={game.id}
                href={`/referee/${game.slug}`}
                className="flex items-center justify-between p-4 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:bg-zinc-900/40 transition"
              >
                <div>
                  <span className="font-medium">{game.name}</span>
                  <span className="ml-3 text-xs text-zinc-500">
                    {game.modus === "DUELL" ? "Duell" : "Solo"} &middot;{" "}
                    {game.playtimeMin} min
                  </span>
                </div>
                <span className="text-zinc-600">&rarr;</span>
              </Link>
            ))}
          </div>
        )}

        {otherGames.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-600 uppercase tracking-wider">
              Noch nicht aktiv
            </p>
            {otherGames.map((game) => (
              <Link
                key={game.id}
                href={`/referee/${game.slug}`}
                className="flex items-center justify-between p-4 border border-zinc-800/50 rounded-lg text-zinc-500 hover:border-zinc-700 transition"
              >
                <span>{game.name}</span>
                <span className="text-zinc-700">&rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Zeitplan View ───
  const blockEntries = Array.from(timeBlocks.entries());

  return (
    <div className="space-y-6 pb-12">
      {gamedayBanner}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Zeitplan</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {zeitplanName ?? "Aktiver Zeitplan"}
        </p>
      </div>

      {blockEntries.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">
          Keine Slots im Zeitplan
        </p>
      )}

      {blockEntries.map(([timeKey, slots]) => {
        const [start, end] = timeKey.split("-");
        return (
          <div key={timeKey} className="space-y-2">
            {/* Time block header */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded">
                {formatTime(start)} – {formatTime(end)}
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Slots in this time block */}
            {slots.map((slot, i) => {
              const isClickable = slot.status !== "ABGESCHLOSSEN";
              return (
                <button
                  key={`${timeKey}-${i}`}
                  onClick={() => handleSlotTap(slot)}
                  disabled={!isClickable}
                  className={`w-full text-left p-4 border rounded-lg transition ${
                    slot.status === "AKTIV"
                      ? "border-amber-800/60 bg-amber-950/20 hover:border-amber-700"
                      : slot.status === "ABGESCHLOSSEN"
                        ? "border-zinc-800/50 bg-zinc-900/30 opacity-60 cursor-default"
                        : "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{slot.gameName}</p>
                      <p className="text-sm text-zinc-400">
                        {slot.teamNames.length > 0
                          ? slot.teamNames.join(" vs. ")
                          : "Keine Teams zugewiesen"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(slot.status)}
                      {isClickable && (
                        <span className="text-zinc-600">&rarr;</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
