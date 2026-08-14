"use client";

import { useCallback, useEffect, useState } from "react";
import { HotPill, StatusPill } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";

type GamedayStatus = {
  modus: "INAKTIV" | "TEST" | "HOT";
  active: boolean;
  startedAt?: string;
  startedBy?: { id: string; name: string } | null;
  id?: string;
  testErgebnisse?: number;
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
        "Alle Test-Ergebnisse werden gelöscht und der Zeitplan-Slot-Status des aktiven Plans wird auf „geplant“ zurückgesetzt (Einsatzplan-Zuweisungen bleiben). Fortfahren?"
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/gameday/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await fetchStatus();
      onStatusChange();
      alert(
        `Zurückgesetzt: ${data.deleted.ergebnisse} Ergebnisse, ${data.resetSlots} Zeitplan-Slots wieder auf „geplant“.`
      );
    } catch (err) {
      alert(
        `Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const switchToHot = async () => {
    // Der HOT-Start wird serverseitig abgelehnt, solange Test-Ergebnisse
    // existieren. Diese Bedingung MUSS vor dem Beenden des Test-Gamedays
    // geprüft werden: Sonst ist der Test-Gameday weg, der HOT-Start scheitert,
    // und sämtliche Schiedsrichter-Geräte zeigen schlagartig "Kein aktiver
    // Gameday" — ohne dass jemand ausser der Person am Leitstand weiss, warum.
    // Frisch vom Server holen: `status` wird nur beim Mounten geladen. Nach
    // einer Stunde Probelauf wäre der Zähler auf dem Bildschirm veraltet und
    // die Prüfung liefe genau in den Fehler, den sie verhindern soll.
    let offeneTestErgebnisse = status?.testErgebnisse ?? 0;
    try {
      const res = await fetch("/api/gameday");
      if (res.ok) offeneTestErgebnisse = (await res.json())?.testErgebnisse ?? 0;
    } catch {
      // Nicht erreichbar — dann gilt der zuletzt bekannte Stand.
    }
    if (offeneTestErgebnisse > 0) {
      alert(
        `HOT-Start nicht möglich: Es liegen noch ${offeneTestErgebnisse} Test-Ergebnisse vor.\n\n` +
          "Zuerst „Test-Daten löschen“ klicken, danach erneut auf HOT wechseln.",
      );
      return;
    }

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
    return <div className="h-[54px] animate-pulse border-b border-line bg-sunken" />;
  }

  const testCount = status?.testErgebnisse ?? 0;

  if (!status || status.modus === "INAKTIV") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-ink-3">Kein aktiver Gameday</span>
          {testCount > 0 && (
            <p className="text-xs text-warn">
              <span className="tnum">{testCount}</span> Test-Ergebnis
              {testCount === 1 ? "" : "se"} vorhanden — vor HOT-Start löschen
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {testCount > 0 && (
            <Button
              variant="ghost"
              onClick={resetTestData}
              disabled={actionLoading}
            >
              Test-Daten löschen (<span className="tnum">{testCount}</span>)
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => startGameday("TEST")}
            disabled={actionLoading}
          >
            Test starten
          </Button>
          <Button
            variant="danger-ghost"
            onClick={() => startGameday("HOT")}
            disabled={actionLoading}
          >
            HOT starten
          </Button>
        </div>
      </div>
    );
  }

  if (status.modus === "TEST") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-action-row px-4 py-2.5 sm:px-[22px]">
        <div className="flex items-center gap-3">
          <StatusPill tone="action">TEST-MODUS</StatusPill>
          <p className="text-xs text-ink-3">
            Gestartet um{" "}
            <span className="tnum">
              {status.startedAt ? formatTime(status.startedAt) : "–"}
            </span>
            {status.startedBy?.name ? ` von ${status.startedBy.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={resetTestData} disabled={actionLoading}>
            Test-Daten löschen
            {testCount > 0 ? (
              <span className="tnum">({testCount})</span>
            ) : null}
          </Button>
          <Button variant="ghost" onClick={stopGameday} disabled={actionLoading}>
            Test beenden
          </Button>
          <Button
            variant="danger-ghost"
            onClick={switchToHot}
            disabled={actionLoading}
          >
            Zu HOT wechseln
          </Button>
        </div>
      </div>
    );
  }

  // HOT
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hot-border)] bg-hot-dim px-4 py-2.5 sm:px-[22px]">
      <div className="flex items-center gap-3">
        <HotPill />
        <p className="text-xs text-hot-tint">
          Produktiver Gameday · gestartet um{" "}
          <span className="tnum">
            {status.startedAt ? formatTime(status.startedAt) : "–"}
          </span>
          {status.startedBy?.name ? ` von ${status.startedBy.name}` : ""}
        </p>
      </div>
      <Button variant="danger-ghost" onClick={stopGameday} disabled={actionLoading}>
        Gameday beenden
      </Button>
    </div>
  );
}
