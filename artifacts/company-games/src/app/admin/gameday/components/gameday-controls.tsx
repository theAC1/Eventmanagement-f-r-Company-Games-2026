"use client";

import { useCallback, useEffect, useState } from "react";

type GamedayStatus = {
  modus: "INAKTIV" | "TEST" | "HOT";
  active: boolean;
  startedAt?: string;
  startedBy?: { id: string; name: string } | null;
  id?: string;
};

type GamedayControlsProps = {
  onStatusChange: () => void;
};

export function GamedayControls({ onStatusChange }: GamedayControlsProps) {
  const [status, setStatus] = useState<GamedayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/gameday");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GamedayStatus = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Gameday-Status laden fehlgeschlagen:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startGameday = async (modus: "TEST" | "HOT") => {
    if (modus === "HOT") {
      const confirmed = window.confirm(
        "Achtung: HOT-Modus startet den produktiven Gameday. Fortfahren?"
      );
      if (!confirmed) return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/gameday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await fetchStatus();
      onStatusChange();
    } catch (err) {
      alert(
        `Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const stopGameday = async () => {
    const isHot = status?.modus === "HOT";
    const message = isHot
      ? "Gameday wirklich beenden? Dies kann nicht rückgängig gemacht werden."
      : "Test-Modus beenden?";

    if (!window.confirm(message)) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/gameday", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await fetchStatus();
      onStatusChange();
    } catch (err) {
      alert(
        `Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const resetTestData = async () => {
    if (
      !window.confirm(
        "Alle Test-Ergebnisse werden gelöscht. Fortfahren?"
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/gameday/reset", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onStatusChange();
    } catch (err) {
      alert(
        `Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const switchToHot = async () => {
    if (
      !window.confirm(
        "Achtung: HOT-Modus startet den produktiven Gameday. Fortfahren?"
      )
    )
      return;

    setActionLoading(true);
    try {
      // First end the test
      const delRes = await fetch("/api/gameday", { method: "DELETE" });
      if (!delRes.ok) {
        const data = await delRes.json();
        throw new Error(data.error ?? `HTTP ${delRes.status}`);
      }

      // Then start HOT
      const postRes = await fetch("/api/gameday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modus: "HOT" }),
      });
      if (!postRes.ok) {
        const data = await postRes.json();
        throw new Error(data.error ?? `HTTP ${postRes.status}`);
      }

      await fetchStatus();
      onStatusChange();
    } catch (err) {
      alert(
        `Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`
      );
      // Refetch in case partial success
      await fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="h-14 rounded-lg border border-zinc-800 bg-zinc-900/50 animate-pulse" />
    );
  }

  if (!status || status.modus === "INAKTIV") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <span className="text-sm text-zinc-400">Kein aktiver Gameday</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startGameday("TEST")}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
          >
            Test starten
          </button>
          <button
            onClick={() => startGameday("HOT")}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
          >
            HOT starten
          </button>
        </div>
      </div>
    );
  }

  if (status.modus === "TEST") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-blue-700 bg-blue-900/40 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-blue-300">
            {"🔵 TEST-MODUS"}
          </p>
          <p className="text-xs text-blue-400/70">
            Gestartet um {status.startedAt ? formatTime(status.startedAt) : "–"}
            {status.startedBy?.name ? ` von ${status.startedBy.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetTestData}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition disabled:opacity-50"
          >
            Test-Daten löschen
          </button>
          <button
            onClick={stopGameday}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition disabled:opacity-50"
          >
            Test beenden
          </button>
          <button
            onClick={switchToHot}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
          >
            Zu HOT wechseln
          </button>
        </div>
      </div>
    );
  }

  // HOT
  return (
    <div className="flex items-center justify-between rounded-lg border border-red-700 bg-red-900/40 px-4 py-3">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-red-300">
          {"🔴 HOT — Produktiver Gameday"}
        </p>
        <p className="text-xs text-red-400/70">
          Gestartet um {status.startedAt ? formatTime(status.startedAt) : "–"}
          {status.startedBy?.name ? ` von ${status.startedBy.name}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={stopGameday}
          disabled={actionLoading}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
        >
          Gameday beenden
        </button>
      </div>
    </div>
  );
}
