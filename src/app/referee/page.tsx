"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CaretRight, CheckCircle } from "@phosphor-icons/react";
import {
  initOfflineQueue,
  subscribeQueue,
  removeEntry,
  entryKey,
  type PendingErgebnis,
} from "@/lib/offline-queue";

/** Erfasste Rohwerte lesbar machen, damit sie notiert werden können. */
function formatRohdaten(rohdaten: Record<string, unknown>): string {
  const teile = Object.entries(rohdaten)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return teile.length > 0 ? teile.join(" · ") : "—";
}
import { HotPill, StatusPill, ModusChip } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";

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
  ergebnisIds: string[];
  feld?: string | null;
};

type MeineSlotsResponse = {
  config: { id: string; name: string; istAktiv: boolean } | null;
  slots: MeinSlot[];
};

// ─── Helpers ───

function formatTime(zeitStr: string): string {
  return zeitStr.slice(0, 5);
}

function teamLine(slot: MeinSlot): React.ReactNode {
  if (slot.teamNames.length === 0) return "Keine Teams zugewiesen";
  return slot.teamNames.map((name, i) => (
    <span key={i}>
      {i > 0 && <span className="text-ink-3"> vs. </span>}
      {name}
    </span>
  ));
}

// ─── Component ───

export default function RefereePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gamedayModus, setGamedayModus] = useState<string | null>(null);
  const [zeitplanName, setZeitplanName] = useState<string | null>(null);
  const [slots, setSlots] = useState<MeinSlot[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [abgelehnt, setAbgelehnt] = useState<PendingErgebnis[]>([]);

  // Offline-Warteschlange: liegengebliebene Ergebnisse weiter übermitteln
  useEffect(() => {
    initOfflineQueue();
    return subscribeQueue((queue) => {
      setPendingCount(queue.filter((e) => !e.abgelehnt).length);
      setAbgelehnt(queue.filter((e) => e.abgelehnt));
    });
  }, []);

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
    // Im Probelauf dürfen abgeschlossene Begegnungen erneut geöffnet werden —
    // eine Generalprobe lebt davon, denselben Posten mehrmals durchzuspielen.
    // Im HOT-Modus bleibt eine abgeschlossene Begegnung abgeschlossen.
    if (slot.status === "ABGESCHLOSSEN") {
      if (gamedayModus !== "TEST") return;
      const params = new URLSearchParams();
      params.set("slotId", slot.slotId);
      if (slot.teamIds.length > 0) params.set("teams", slot.teamIds.join(","));
      router.push(`/referee/${slot.gameSlug}/checkin?${params.toString()}`);
      return;
    }

    if (slot.status === "AKTIV") {
      // Laufende Begegnung: direkt in die Live-Erfassung mit den offenen Ergebnissen
      const params = new URLSearchParams();
      if (slot.ergebnisIds.length > 0) params.set("ergebnisIds", slot.ergebnisIds.join(","));
      params.set("slotId", slot.slotId);
      router.push(`/referee/${slot.gameSlug}/live?${params.toString()}`);
      return;
    }

    // GEPLANT → Check-in-Flow für genau diesen Slot
    const params = new URLSearchParams();
    params.set("slotId", slot.slotId);
    if (slot.teamIds.length > 0) params.set("teams", slot.teamIds.join(","));
    router.push(`/referee/${slot.gameSlug}/checkin?${params.toString()}`);
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md items-center justify-center text-sm text-ink-3">
        Lade Einsätze...
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md flex-col items-center justify-center gap-4">
        <p className="text-sm text-hot-tint">{error}</p>
        <Button variant="ghost" onClick={() => { setLoading(true); loadData(); }}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  // ─── Gameday INAKTIV ───
  if (gamedayModus === "INAKTIV") {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md flex-col items-center justify-center gap-4">
        <p className="text-center text-sm text-ink-3">
          Kein aktiver Gameday. Bitte warte bis die Orga den Gameday startet.
        </p>
        <Button variant="ghost" onClick={() => { setLoading(true); loadData(); }}>
          Erneut prüfen
        </Button>
      </div>
    );
  }

  // Offene Slots chronologisch, abgeschlossene ans Ende (ausgegraut)
  const activeSlots = slots.filter((s) => s.status === "AKTIV");
  const plannedSlots = slots.filter((s) => s.status === "GEPLANT");
  const doneSlots = slots.filter((s) => s.status === "ABGESCHLOSSEN");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-[18px] pb-12">
      {/* Titel + Gameday-Status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Mein Tagesplan</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {zeitplanName ?? "Deine Einsätze"}
            {slots.length > 0 && (
              <>
                {" · "}
                <span className="tnum">{slots.length}</span>
                {slots.length === 1 ? " Einsatz" : " Einsätze"}
              </>
            )}
          </p>
        </div>
        {gamedayModus === "HOT" && <HotPill label="LIVE" className="mt-1 shrink-0" />}
        {gamedayModus === "TEST" && (
          <StatusPill tone="action" className="mt-1 shrink-0">TEST-MODUS</StatusPill>
        )}
      </div>

      {gamedayModus === "TEST" && (
        <div className="rounded-xl border border-line bg-action-dim px-4 py-3 text-[13px] text-action-tint">
          Test-Modus — Ergebnisse werden als Testdaten markiert.
        </div>
      )}

      {/* Offline-Warteschlange */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-[var(--warn-border)] bg-warn-dim/60 px-4 py-3 text-[13px] text-ink-2">
          <span className="tnum font-semibold text-warn">{pendingCount}</span>{" "}
          {pendingCount === 1
            ? "Ergebnis wartet auf Übermittlung — wird automatisch gesendet, sobald Verbindung besteht."
            : "Ergebnisse warten auf Übermittlung — werden automatisch gesendet, sobald Verbindung besteht."}
        </div>
      )}

      {/* Endgültig abgelehnte Einträge — der Schiedsrichter muss wissen, dass
          dieses Resultat NICHT gespeichert wurde. */}
      {abgelehnt.map((e) => (
        <div
          key={e.commitId}
          className="flex flex-col gap-2 rounded-xl border border-[var(--hot-border)] bg-hot-dim/60 px-4 py-3 text-[13px] text-ink-2"
        >
          <span>
            <span className="font-semibold text-hot-tint">Nicht gespeichert:</span>{" "}
            {e.gameName} · {e.teamName}
            {e.lastError ? ` — ${e.lastError}` : ""}
          </span>
          {/* Die erfassten Zahlen anzeigen: Es ist die letzte Kopie, die es
              noch gibt — so kann die Orga sie abschreiben. */}
          <span className="tnum text-ink-2">Erfasst: {formatRohdaten(e.rohdaten)}</span>
          <span className="text-ink-3">Bitte der Orga melden.</span>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Dieses nicht gespeicherte Ergebnis endgültig ausblenden?\n\n${e.gameName} · ${e.teamName}\nWerte: ${formatRohdaten(e.rohdaten)}\n\nBitte vorher der Orga melden — danach sind die Zahlen weg.`,
                )
              ) {
                removeEntry(entryKey(e));
              }
            }}
            className="self-start rounded-lg border border-line-strong px-3 py-1 text-[12px] font-medium text-ink-3 hover:text-ink"
          >
            Verstanden, ausblenden
          </button>
        </div>
      ))}

      {/* Leer-Zustand */}
      {slots.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="font-medium text-ink-2">Noch keine Einsätze zugeteilt</p>
          <p className="text-sm text-ink-3">
            Sobald dir die Orga Begegnungen zuweist, erscheinen sie hier.
          </p>
        </div>
      )}

      {/* JETZT — aktive Slots als Hero-Karten */}
      {activeSlots.map((slot) => (
        <div
          key={slot.slotId}
          className="anim-rise rounded-[14px] border-[1.5px] border-[var(--warn-border)] bg-warn-dim/60 p-[18px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-warn">
              Jetzt{slot.runde !== undefined ? ` · Slot ${slot.runde}` : ""}
            </span>
            <span className="tnum text-[13px] text-ink-2">
              {formatTime(slot.startZeit)} – {formatTime(slot.endZeit)}
            </span>
          </div>
          <p className="mt-2.5 text-[20px] font-semibold tracking-tight">{slot.gameName}</p>
          <p className="mt-1 text-[16px] text-ink-2">{teamLine(slot)}</p>
          <div className="mt-2.5 flex items-center gap-2">
            {slot.gameModus && <ModusChip modus={slot.gameModus} size="large" />}
            {slot.feld && (
              <span className="text-[12px] font-medium text-ink-2">Feld {slot.feld}</span>
            )}
            <span className="text-[12px] text-ink-3">läuft gerade</span>
          </div>
          <Button
            variant="cta"
            className="mt-4 w-full"
            onClick={() => handleSlotTap(slot)}
          >
            Erfassung öffnen →
          </Button>
        </div>
      ))}

      {/* DANACH */}
      {plannedSlots.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="cg-label text-[11px] text-label">Danach</p>
          {plannedSlots.map((slot) => (
            <button
              key={slot.slotId}
              onClick={() => handleSlotTap(slot)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-colors duration-150 hover:bg-sunken/60"
            >
              <span className="tnum w-11 shrink-0 text-[13px] text-ink-3">
                {formatTime(slot.startZeit)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[16px] font-[550] text-ink">
                  {slot.gameName}
                </span>
                <span className="truncate text-[12px] text-ink-3">
                  {slot.feld ? `Feld ${slot.feld} · ` : ""}
                  {slot.teamNames.length > 0
                    ? slot.teamNames.join(" vs. ")
                    : "Keine Teams zugewiesen"}
                </span>
              </span>
              <CaretRight size={15} weight="bold" className="shrink-0 text-faint" />
            </button>
          ))}
        </div>
      )}

      {/* ERLEDIGT */}
      {doneSlots.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="cg-label text-[11px] text-label">
            Erledigt · <span className="tnum">{doneSlots.length}</span>
          </p>
          {doneSlots.map((slot) => {
            // Im Probelauf ist eine erledigte Begegnung wieder anklickbar,
            // damit derselbe Posten mehrmals durchgespielt werden kann.
            const wiederholbar = gamedayModus === "TEST";
            return (
              <div
                key={slot.slotId}
                onClick={wiederholbar ? () => handleSlotTap(slot) : undefined}
                role={wiederholbar ? "button" : undefined}
                tabIndex={wiederholbar ? 0 : undefined}
                onKeyDown={
                  wiederholbar
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") handleSlotTap(slot);
                      }
                    : undefined
                }
                className={`flex h-12 items-center gap-3 rounded-xl border border-line-soft px-4${
                  wiederholbar ? " cursor-pointer transition-colors hover:border-action" : ""
                }`}
              >
                <CheckCircle size={17} weight="bold" className="shrink-0 text-done" />
                <span className="tnum w-10 shrink-0 text-[13px] text-label">
                  {formatTime(slot.startZeit)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink-3">
                  {slot.gameName}
                  {slot.teamNames.length > 0 && ` · ${slot.teamNames.join(" vs. ")}`}
                </span>
                {wiederholbar && (
                  <span className="shrink-0 text-[11px] font-medium text-ink-3">
                    Nochmals
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
