"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { initOfflineQueue, subscribeQueue } from "@/lib/offline-queue";
import type { Wertungslogik } from "@/lib/wertungslogik-types";
import { StatusPill } from "@/components/ui/pills";
import { LiveErfassung } from "@/components/wertung/live-erfassung";
import { hatMinimumDaten } from "@/components/wertung/minimum-daten";
import { initialisiereRohdaten } from "@/components/wertung/rohdaten-init";

// ─── Types ───

type Game = {
  id: string;
  name: string;
  slug: string;
  modus: string;
  teamsProSlot: number;
  wertungslogik: Wertungslogik | null;
  // Zusatzfelder aus derselben API-Antwort — nur für das Tablet-Briefing links
  kurzbeschreibung?: string | null;
  regeln?: string | null;
  playtimeMin?: number;
  flaecheLaengeM?: number | null;
  flaecheBreiteM?: number | null;
};

type Ergebnis = {
  id: string;
  teamId: string;
  gameId: string;
  rohdaten: Record<string, unknown>;
  eingetragenUm: string | null;
  team: { id: string; name: string; nummer: number };
};

// ─── Helpers ───

function regelnAlsListe(regeln: string): string[] {
  return regeln
    .split("\n")
    .map((z) => z.replace(/^\s*[-–•*]\s*/, "").trim())
    .filter((z) => z.length > 0);
}

// ─── GameTimer Component ───

function GameTimer({
  startTime,
  slotEndZeit,
}: {
  startTime: Date;
  slotEndZeit?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Check if we're past the slot end time
  const isOvertime = slotEndZeit ? (() => {
    const now = new Date();
    const [h, m] = slotEndZeit.split(":").map(Number);
    const end = new Date(now);
    end.setHours(h, m, 0, 0);
    return now > end;
  })() : false;

  return (
    <div className="border-b border-line px-[18px] pb-4 pt-[22px] text-center">
      <p
        className={`tnum text-[56px] font-bold leading-none tracking-[-0.02em] lg:text-[64px] ${
          isOvertime ? "text-hot-tint" : "text-ink"
        }`}
      >
        {formatted}
      </p>
      {isOvertime && (
        <p className="tnum mt-2 text-[13px] text-hot-tint">Zeitslot überschritten</p>
      )}
      {slotEndZeit && !isOvertime && (
        <p className="tnum mt-2 text-[13px] text-ink-3">
          Slot endet um {slotEndZeit.slice(0, 5)}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ───

export default function LivePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const slotId = searchParams.get("slotId") ?? undefined;
  const ergebnisIdsParam = searchParams.get("ergebnisIds") ?? "";

  const [game, setGame] = useState<Game | null>(null);
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slotEndZeit, setSlotEndZeit] = useState<string | undefined>();
  const [pendingCount, setPendingCount] = useState(0);

  // Rohdaten for each team (indexed by ergebnis.id)
  const [rohdatenMap, setRohdatenMap] = useState<Record<string, Record<string, unknown>>>({});

  // Offline-Warteschlange beobachten (nur Anzeige der Queue-Pille)
  useEffect(() => {
    initOfflineQueue();
    // Endgültig abgelehnte Einträge zählen nicht als "wartet auf Übermittlung"
    // — sie werden nicht mehr gesendet (siehe referee/page.tsx für die Anzeige).
    return subscribeQueue((queue) =>
      setPendingCount(queue.filter((e) => !e.abgelehnt).length),
    );
  }, []);

  // Load game + ergebnisse
  useEffect(() => {
    const load = async () => {
      try {
        // Fetch game
        const gameRes = await fetch(`/api/games/by-slug/${slug}`);
        if (!gameRes.ok) throw new Error("Game nicht gefunden");
        const gameData: Game = await gameRes.json();
        setGame(gameData);

        // Fetch ergebnisse by IDs
        const ids = ergebnisIdsParam.split(",").filter(Boolean);
        if (ids.length > 0) {
          const ergebnisData = await Promise.all(
            ids.map(async (id) => {
              const res = await fetch(`/api/ergebnisse/${id}`);
              if (!res.ok) return null;
              return res.json();
            })
          );
          const valid = ergebnisData.filter(Boolean) as Ergebnis[];
          setErgebnisse(valid);

          // Initialize rohdaten from existing + Struktur-Defaults
          // (z. B. sieg_zuege 0/0, volle Rundenliste), damit auch ein
          // Team ohne Zählerklick speicherbar bleibt.
          const initMap: Record<string, Record<string, unknown>> = {};
          for (const e of valid) {
            initMap[e.id] = initialisiereRohdaten(
              (e.rohdaten as Record<string, unknown>) ?? {},
              gameData.wertungslogik,
            );
          }
          setRohdatenMap(initMap);
        }

        // Slot-Endzeit für den Timer laden (nicht kritisch — Timer läuft auch ohne)
        if (slotId) {
          try {
            const slotRes = await fetch(`/api/zeitplan-slots/${slotId}`);
            if (slotRes.ok) {
              const slotData: { endZeit?: string } = await slotRes.json();
              if (slotData.endZeit) setSlotEndZeit(slotData.endZeit);
            }
          } catch {
            // Endzeit optional — Erfassung darf daran nicht scheitern
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, ergebnisIdsParam, slotId]);

  const updateRohdaten = (ergebnisId: string, key: string, value: unknown) => {
    setRohdatenMap((prev) => ({
      ...prev,
      [ergebnisId]: { ...(prev[ergebnisId] ?? {}), [key]: value },
    }));
  };

  const handleErgebnisEintragen = () => {
    if (!game) return;

    // Collect all rohdaten and navigate to bestaetigung
    const payload = ergebnisse.map((e) => ({
      ergebnisId: e.id,
      teamId: e.teamId,
      teamName: e.team.name,
      rohdaten: rohdatenMap[e.id] ?? {},
    }));

    // Store in sessionStorage to pass between pages
    sessionStorage.setItem("bestaetigung_data", JSON.stringify({
      gameId: game.id,
      gameName: game.name,
      gameSlug: game.slug,
      slotId,
      wertungslogik: game.wertungslogik,
      entries: payload,
    }));

    router.push(`/referee/${slug}/bestaetigung`);
  };

  // Check if minimum data is entered
  const hasMinimumData = (): boolean => {
    const wl = game?.wertungslogik;
    if (!wl) return false;
    // Ohne geladene Ergebnisse (z.B. fehlende ergebnisIds) darf nichts übermittelt werden
    if (ergebnisse.length === 0) return false;
    return ergebnisse.every((e) => hatMinimumDaten(wl, rohdatenMap[e.id] ?? {}));
  };

  // ─── Loading / Error ───

  if (loading) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md items-center justify-center text-sm text-ink-3">
        Lade Partie...
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-md flex-col items-center justify-center gap-3">
        <p className="text-sm text-hot-tint">{error ?? "Game nicht gefunden"}</p>
        <Link href="/referee" className="text-sm text-action transition-colors duration-150 hover:text-ink">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const wl = game.wertungslogik;
  const isDuell = game.modus === "DUELL" && game.teamsProSlot >= 2;
  const startTime = ergebnisse[0]?.eingetragenUm
    ? new Date(ergebnisse[0].eingetragenUm)
    : new Date();
  const regeln = game.regeln ? regelnAlsListe(game.regeln) : [];

  const teamsLabel = isDuell
    ? ergebnisse.map((e) => e.team.name).join(" vs. ")
    : ergebnisse[0]?.team.name ?? "Partie";

  // ─── Erfassungswerkzeuge (Handy: Hauptspalte / Tablet: rechte Spalte) ───

  const erfassung = wl && (
    <LiveErfassung
      wertungslogik={wl}
      ergebnisse={ergebnisse}
      rohdatenMap={rohdatenMap}
      isDuell={isDuell}
      onUpdate={updateRohdaten}
    />
  );

  // ─── Render ───

  return (
    <div className="mx-auto w-full max-w-md pb-36 lg:max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3">
        <Link
          href="/referee"
          aria-label="Zurück zum Tagesplan"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft size={18} weight="bold" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-semibold tracking-tight">{game.name}</h1>
          <p className="truncate text-[11px] text-ink-3">{teamsLabel}</p>
        </div>
        {pendingCount > 0 && (
          <StatusPill tone="warn" className="shrink-0">
            <span className="tnum">{pendingCount}</span>&nbsp;IN WARTESCHLANGE
          </StatusPill>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[420px_1fr] lg:gap-6">
        {/* Linke Spalte (nur Tablet/Desktop): Wertung + Regeln */}
        <div className="hidden lg:flex lg:flex-col lg:gap-[18px]">
          <div className="rounded-[14px] border border-line bg-surface p-[18px]">
            <p className="cg-label text-[11px] text-label">Wertung</p>
            {game.kurzbeschreibung && (
              <p className="mt-2 text-[15px] leading-[1.4] text-ink-2">
                {game.kurzbeschreibung}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {game.playtimeMin !== undefined && (
                <span className="tnum inline-flex items-center rounded-md bg-raised px-2 py-1 text-[12px] text-ink-2">
                  max {game.playtimeMin} min
                </span>
              )}
              {game.flaecheLaengeM && game.flaecheBreiteM && (
                <span className="tnum inline-flex items-center rounded-md bg-raised px-2 py-1 text-[12px] text-ink-2">
                  {game.flaecheLaengeM}×{game.flaecheBreiteM} m
                </span>
              )}
              {wl?.einheit && (
                <span className="tnum inline-flex items-center rounded-md bg-raised px-2 py-1 text-[12px] text-ink-2">
                  {wl.einheit}
                </span>
              )}
            </div>
          </div>

          {regeln.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="cg-label text-[11px] text-label">Regeln am Feld</p>
              {regeln.map((r, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-action" />
                  <span className="text-[14px] leading-[1.45] text-ink-2">{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rechte Spalte: Timer + Erfassung */}
        <div className="-mx-[18px] lg:mx-0">
          <GameTimer startTime={startTime} slotEndZeit={slotEndZeit} />
          {erfassung}
        </div>
      </div>

      {/* Fixe Bottom-Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-line bg-bg/95 px-[18px] pb-[26px] pt-3.5 backdrop-blur">
        <div className="mx-auto w-full max-w-md lg:max-w-5xl">
          <button
            onClick={handleErgebnisEintragen}
            disabled={!hasMinimumData()}
            className="h-16 w-full rounded-xl bg-action text-[19px] font-bold text-on-action transition-colors duration-150 hover:bg-action-hover disabled:pointer-events-none disabled:opacity-30"
          >
            Ergebnis eintragen
          </button>
          <p className="mt-2 text-center text-[12px] text-ink-3">
            Nächster Schritt: Bestätigung durch beide Teams
          </p>
        </div>
      </div>
    </div>
  );
}
