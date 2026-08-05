"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { initOfflineQueue, subscribeQueue } from "@/lib/offline-queue";
import { StatusPill } from "@/components/ui/pills";

// ─── Types ───

type EingabeFeld = { name: string; typ: string; label: string };
type Level = { name: string; grundpunkte: number };
type Option = { name: string; punkte_erfolg: number; punkte_fail: number };

type Wertungslogik = {
  typ?: string;
  einheit?: string;
  richtung?: string;
  messung?: string;
  eingabefelder?: EingabeFeld[];
  levels?: Level[];
  optionen?: Option[];
  strafen?: Record<string, number>;
  nicht_geschafft?: string;
};

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

// ─── ScoreCounter Component ───

function ScoreCounter({
  teamName,
  score,
  onChange,
}: {
  teamName: string;
  score: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-[14px] border border-line bg-surface p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[16px] font-semibold text-ink">{teamName}</span>
        <span className="tnum text-[11px] font-semibold text-label">PUNKTE</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => onChange(Math.max(0, score - 1))}
          aria-label="Minus"
          className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[14px] border border-line-key bg-raised text-[30px] font-semibold text-ink-2 transition-colors duration-150 active:bg-sunken lg:h-16 lg:w-16"
        >
          −
        </button>
        <span
          key={score}
          className="anim-count tnum flex-1 text-center text-[64px] font-bold leading-none text-ink"
        >
          {score}
        </span>
        <button
          onClick={() => onChange(score + 1)}
          aria-label="Plus"
          className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[14px] border border-action bg-action-dim-strong text-[30px] font-semibold text-action-tint transition-colors duration-150 active:bg-action-dim lg:h-16 lg:w-16"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Stopwatch Component ───

function Stopwatch({
  onTimeRecorded,
  penalties,
  rohdaten,
  onPenalty,
}: {
  onTimeRecorded: (seconds: number) => void;
  penalties?: Record<string, number>;
  rohdaten: Record<string, unknown>;
  onPenalty: (key: string, value: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (startRef.current !== null) {
      setTime(Math.floor((Date.now() - startRef.current) / 1000));
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const toggleTimer = () => {
    if (running) {
      // Stop
      setRunning(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
      onTimeRecorded(time);
    } else {
      // Start
      setRunning(true);
      startRef.current = Date.now();
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="tnum text-[56px] font-bold leading-none tracking-[-0.02em] text-ink lg:text-[64px]">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
      </div>

      <button
        onClick={toggleTimer}
        className={`h-16 w-full rounded-[14px] text-[19px] font-bold transition-colors duration-150 ${
          running
            ? "bg-hot text-on-hot hover:brightness-110"
            : "border-[1.5px] border-done bg-done-dim text-done-tint"
        }`}
      >
        {running ? "Stopp" : time > 0 ? "Weiter" : "Start"}
      </button>

      {/* Penalty counters */}
      {penalties && Object.entries(penalties).map(([key, sek]) => {
        const wert = Number(rohdaten[key]) || 0;
        return (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium capitalize text-ink">{key.replace(/_/g, " ")}</p>
              <p className="tnum mt-0.5 text-[12px] text-ink-3">+{sek} s pro Vergehen</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => onPenalty(key, Math.max(0, wert - 1))}
                aria-label="Minus"
                className="flex h-16 w-16 items-center justify-center rounded-xl border border-line-key bg-raised text-[26px] font-semibold text-ink-2 transition-colors duration-150 active:bg-sunken"
              >
                −
              </button>
              <span
                key={wert}
                className="anim-count tnum w-10 text-center text-[34px] font-bold leading-none text-ink"
              >
                {wert}
              </span>
              <button
                onClick={() => onPenalty(key, wert + 1)}
                aria-label="Plus"
                className="flex h-16 w-16 items-center justify-center rounded-xl border border-action bg-action-dim-strong text-[26px] font-semibold text-action-tint transition-colors duration-150 active:bg-action-dim"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
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
    return subscribeQueue((queue) => setPendingCount(queue.length));
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

          // Initialize rohdaten from existing
          const initMap: Record<string, Record<string, unknown>> = {};
          for (const e of valid) {
            initMap[e.id] = (e.rohdaten as Record<string, unknown>) ?? {};
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
    if (!game?.wertungslogik) return false;
    // Ohne geladene Ergebnisse (z.B. fehlende ergebnisIds) darf nichts übermittelt werden
    if (ergebnisse.length === 0) return false;
    const wl = game.wertungslogik;

    for (const e of ergebnisse) {
      const rd = rohdatenMap[e.id] ?? {};

      switch (wl.typ) {
        case "punkte_duell": {
          const felder = wl.eingabefelder ?? [];
          if (felder.length > 0 && rd[felder[0].name] === undefined) return false;
          break;
        }
        case "zeit": {
          if (rd.zeit_sekunden === undefined && !wl.eingabefelder?.length) return false;
          break;
        }
        case "max_value": {
          if (wl.eingabefelder?.length && rd[wl.eingabefelder[0].name] === undefined) return false;
          break;
        }
        case "multi_level": {
          if (!rd.level) return false;
          break;
        }
        case "risiko_wahl": {
          if (!rd.option || rd.erfolg === undefined) return false;
          break;
        }
        case "formel": {
          if (wl.eingabefelder?.some((f) => rd[f.name] === undefined)) return false;
          break;
        }
      }
    }
    return true;
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
    <div className="flex flex-col gap-3.5 px-[18px] py-[18px] lg:px-0">
      {/* PUNKTE_DUELL: Two score counters */}
      {wl.typ === "punkte_duell" && isDuell && (
        <div className="flex flex-col gap-3.5">
          {ergebnisse.map((e, i) => {
            const felder = wl.eingabefelder ?? [];
            const fieldIdx = Math.min(i, felder.length - 1);
            const field = felder[fieldIdx];
            const rd = rohdatenMap[e.id] ?? {};
            const score = field ? (Number(rd[field.name]) || 0) : 0;

            return (
              <ScoreCounter
                key={e.id}
                teamName={e.team.name}
                score={score}
                onChange={(val) => {
                  if (field) updateRohdaten(e.id, field.name, val);
                }}
              />
            );
          })}
        </div>
      )}

      {/* PUNKTE_DUELL: Solo mode — single counter */}
      {wl.typ === "punkte_duell" && !isDuell && ergebnisse[0] && (() => {
        const e = ergebnisse[0];
        const felder = wl.eingabefelder ?? [];
        const field = felder[0];
        const rd = rohdatenMap[e.id] ?? {};
        const score = field ? (Number(rd[field.name]) || 0) : 0;

        return (
          <ScoreCounter
            teamName={e.team.name}
            score={score}
            onChange={(val) => {
              if (field) updateRohdaten(e.id, field.name, val);
            }}
          />
        );
      })()}

      {/* ZEIT: Stopwatch + penalties */}
      {wl.typ === "zeit" && ergebnisse.map((e) => (
        <div key={e.id} className="flex flex-col gap-3">
          {isDuell && (
            <p className="text-sm font-medium text-ink-2">{e.team.name}</p>
          )}
          <Stopwatch
            onTimeRecorded={(sek) => updateRohdaten(e.id, "zeit_sekunden", sek)}
            penalties={wl.strafen}
            rohdaten={rohdatenMap[e.id] ?? {}}
            onPenalty={(key, val) => updateRohdaten(e.id, key, val)}
          />
          {wl.nicht_geschafft && (
            <div className="mt-0.5 flex gap-3">
              <button
                onClick={() => updateRohdaten(e.id, "nicht_geschafft", false)}
                className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                  (rohdatenMap[e.id] ?? {}).nicht_geschafft !== true
                    ? "border-[1.5px] border-done bg-done-dim font-semibold text-done-tint"
                    : "border border-line-strong font-medium text-ink-3"
                }`}
              >
                Geschafft
              </button>
              <button
                onClick={() => updateRohdaten(e.id, "nicht_geschafft", true)}
                className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                  (rohdatenMap[e.id] ?? {}).nicht_geschafft === true
                    ? "border-[1.5px] border-[var(--hot-border)] bg-hot-dim font-semibold text-hot-tint"
                    : "border border-line-strong font-medium text-ink-3"
                }`}
              >
                Nicht geschafft
              </button>
            </div>
          )}
        </div>
      ))}

      {/* MAX_VALUE: Large number input */}
      {wl.typ === "max_value" && ergebnisse.map((e) => {
        const field = wl.eingabefelder?.[0] ?? { name: wl.messung ?? "wert", label: wl.einheit ?? "Wert" };
        const rd = rohdatenMap[e.id] ?? {};

        return (
          <div key={e.id} className="flex flex-col gap-1.5">
            {isDuell && (
              <p className="text-sm font-medium text-ink-2">{e.team.name}</p>
            )}
            <label className="cg-label text-label">{field.label}</label>
            <input
              type="number"
              inputMode="decimal"
              value={(rd[field.name] as string) ?? ""}
              onChange={(ev) => updateRohdaten(e.id, field.name, Number(ev.target.value) || 0)}
              className="tnum w-full rounded-[9px] border border-line-strong bg-sunken px-4 py-4 text-center text-3xl text-ink placeholder:text-faint focus:border-action focus:outline-none"
              placeholder="0"
            />
          </div>
        );
      })}

      {/* FORMEL: Multiple number inputs */}
      {wl.typ === "formel" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        return (
          <div key={e.id} className="flex flex-col gap-3">
            {isDuell && (
              <p className="text-sm font-medium text-ink-2">{e.team.name}</p>
            )}
            {wl.eingabefelder?.map((f) => (
              <div key={f.name} className="flex flex-col gap-1">
                <label className="cg-label text-label">{f.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={(rd[f.name] as string) ?? ""}
                  onChange={(ev) => updateRohdaten(e.id, f.name, Number(ev.target.value) || 0)}
                  className="tnum h-12 w-full rounded-[9px] border border-line-strong bg-sunken px-4 text-lg text-ink placeholder:text-faint focus:border-action focus:outline-none"
                />
              </div>
            ))}
          </div>
        );
      })}

      {/* MULTI_LEVEL: Large level buttons */}
      {wl.typ === "multi_level" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        return (
          <div key={e.id} className="flex flex-col gap-2">
            {isDuell && (
              <p className="text-sm font-medium text-ink-2">{e.team.name}</p>
            )}
            <label className="cg-label text-label">Schwierigkeit</label>
            <div className="grid grid-cols-2 gap-2.5">
              {wl.levels?.map((l) => (
                <button
                  key={l.name}
                  onClick={() => updateRohdaten(e.id, "level", l.name)}
                  className={`min-h-16 rounded-xl px-3 py-3 text-sm capitalize transition-colors duration-150 ${
                    rd.level === l.name
                      ? "bg-action font-semibold text-on-action"
                      : "border border-line-strong font-medium text-ink-2"
                  }`}
                >
                  {l.name}
                  <span className="tnum mt-0.5 block text-xs opacity-70">
                    {l.grundpunkte} Punkte
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* RISIKO_WAHL: Option buttons + success/fail toggle */}
      {wl.typ === "risiko_wahl" && ergebnisse.map((e) => {
        const rd = rohdatenMap[e.id] ?? {};
        return (
          <div key={e.id} className="flex flex-col gap-4">
            {isDuell && (
              <p className="text-sm font-medium text-ink-2">{e.team.name}</p>
            )}

            <div className="flex flex-col gap-2">
              <label className="cg-label text-label">Wahl</label>
              <div className="grid grid-cols-2 gap-2.5">
                {wl.optionen?.map((o) => (
                  <button
                    key={o.name}
                    onClick={() => updateRohdaten(e.id, "option", o.name)}
                    className={`min-h-16 rounded-xl px-3 py-3 text-sm transition-colors duration-150 ${
                      rd.option === o.name
                        ? "bg-action font-semibold text-on-action"
                        : "border border-line-strong font-medium text-ink-2"
                    }`}
                  >
                    {o.name}
                    <span className="tnum mt-0.5 block text-xs opacity-70">
                      {o.punkte_erfolg} P
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="cg-label text-label">Erfolg?</label>
              <div className="flex gap-3">
                <button
                  onClick={() => updateRohdaten(e.id, "erfolg", true)}
                  className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                    rd.erfolg === true
                      ? "border-[1.5px] border-done bg-done-dim font-semibold text-done-tint"
                      : "border border-line-strong font-medium text-ink-3"
                  }`}
                >
                  Ja
                </button>
                <button
                  onClick={() => updateRohdaten(e.id, "erfolg", false)}
                  className={`h-16 flex-1 rounded-xl text-[17px] transition-colors duration-150 ${
                    rd.erfolg === false
                      ? "border-[1.5px] border-[var(--hot-border)] bg-hot-dim font-semibold text-hot-tint"
                      : "border border-line-strong font-medium text-ink-3"
                  }`}
                >
                  Nein
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
