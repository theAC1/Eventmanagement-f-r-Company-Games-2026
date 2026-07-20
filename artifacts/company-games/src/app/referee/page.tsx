"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocation } from 'wouter';

// ─── Types ───

type MeinSlot = {
  slotId: string;
  status: "GEPLANT" | "AKTIV" | "ABGESCHLOSSEN";
  runde?: number;
  startZeit: string;
  endZeit: string;
  gameId: string;
  gameName: string;
  gameSlug: string;
  gameModus?: string;
  teamsProSlot?: number;
  teamIds: string[];
  teamNames: string[];
};

type MeineSlotsResponse = {
  config: { id: string; name: string; istAktiv: boolean } | null;
  slots: MeinSlot[];
};

// ─── Helpers ───

function formatTime(zeitStr: string): string {
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
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gamedayModus, setGamedayModus] = useState<string | null>(null);
  const [zeitplanName, setZeitplanName] = useState<string | null>(null);
  const [slots, setSlots] = useState<MeinSlot[]>([]);

  const loadData = useCallback(async () => {
    try {
      // 0. Gameday status
      const gdRes = await fetch("/api/gameday");
      if (gdRes.ok) {
        const gdData = await gdRes.json();
        setGamedayModus(gdData.modus ?? "INAKTIV");
        if (gdData.modus === "INAKTIV") {
          setLoading(false);
          return;
        }
      }

      // 1. Persönliche Slots
      const res = await fetch("/api/schiedsrichter/meine-slots");
      if (!res.ok) throw new Error("Einsätze laden fehlgeschlagen");
      const data: MeineSlotsResponse = await res.json();

      setZeitplanName(data.config?.name ?? null);
      setSlots(data.slots);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSlotTap = (slot: MeinSlot) => {
    if (slot.status === "ABGESCHLOSSEN") return;

    if (slot.status === "AKTIV") {
      navigate(`/referee/${slot.gameSlug}/live?slotId=${slot.slotId}`);
      return;
    }

    // GEPLANT → Check-in-Flow für genau diesen Slot
    const params = new URLSearchParams();
    params.set("slotId", slot.slotId);
    if (slot.teamIds.length > 0) params.set("teams", slot.teamIds.join(","));
    navigate(`/referee/${slot.gameSlug}/checkin?${params.toString()}`);
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Einsätze...
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

  // Offene Slots chronologisch, abgeschlossene ans Ende (ausgegraut)
  const openSlots = slots.filter((s) => s.status !== "ABGESCHLOSSEN");
  const doneSlots = slots.filter((s) => s.status === "ABGESCHLOSSEN");

  const renderSlot = (slot: MeinSlot) => {
    const isClickable = slot.status !== "ABGESCHLOSSEN";
    const isDuell = slot.teamIds.length >= 2;
    return (
      <button
        key={slot.slotId}
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
            <p className="text-xs font-mono text-zinc-500">
              {formatTime(slot.startZeit)} – {formatTime(slot.endZeit)}
            </p>
            <p className="font-medium">{slot.gameName}</p>
            <p className="text-sm text-zinc-400">
              {slot.teamNames.length > 0
                ? slot.teamNames.join(" vs. ")
                : "Keine Teams zugewiesen"}
              {isDuell && (
                <span className="ml-2 text-xs text-zinc-600 uppercase tracking-wide">Duell</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(slot.status)}
            {isClickable && <span className="text-zinc-600">&rarr;</span>}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {gamedayBanner}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mein Tagesplan</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {zeitplanName ?? "Deine Einsätze"}
        </p>
      </div>

      {slots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-zinc-400 font-medium">Noch keine Einsätze zugeteilt</p>
          <p className="text-sm text-zinc-600">
            Sobald dir die Orga Begegnungen zuweist, erscheinen sie hier.
          </p>
        </div>
      )}

      {openSlots.length > 0 && <div className="space-y-2">{openSlots.map(renderSlot)}</div>}

      {doneSlots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Abgeschlossen</p>
          {doneSlots.map(renderSlot)}
        </div>
      )}
    </div>
  );
}
