"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
};

type Ergebnis = {
  id: string;
  teamId: string;
  gameId: string;
  rohdaten: Record<string, unknown>;
  eingetragenUm: string | null;
  team: { id: string; name: string; nummer: number };
};

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
    <div className="text-center py-6">
      <p className={`text-5xl font-mono font-bold tabular-nums ${isOvertime ? "text-red-400" : "text-white"}`}>
        {formatted}
      </p>
      {isOvertime && (
        <p className="text-xs text-red-400 mt-1">Zeitslot überschritten</p>
      )}
      {slotEndZeit && !isOvertime && (
        <p className="text-xs text-zinc-500 mt-1">Slot endet um {slotEndZeit.slice(0, 5)}</p>
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
    <div className="flex-1 flex flex-col items-center gap-3 p-4 border border-zinc-800 rounded-lg">
      <p className="text-sm font-medium text-zinc-400 truncate max-w-full">{teamName}</p>
      <p className="text-4xl font-mono font-bold tabular-nums">{score}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(Math.max(0, score - 1))}
          className="w-12 h-12 flex items-center justify-center rounded-lg border border-zinc-700 text-xl font-bold text-zinc-400 hover:bg-zinc-800 active:bg-zinc-700 transition"
        >
          -
        </button>
        <button
          onClick={() => onChange(score + 1)}
          className="w-12 h-12 flex items-center justify-center rounded-lg border border-zinc-700 text-xl font-bold text-white hover:bg-zinc-800 active:bg-zinc-700 transition"
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
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-4xl font-mono font-bold tabular-nums">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
      </div>

      <button
        onClick={toggleTimer}
        className={`w-full py-4 text-lg font-semibold rounded-lg transition ${
          running
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-emerald-600 hover:bg-emerald-500 text-white"
        }`}
      >
        {running ? "Stopp" : time > 0 ? "Weiter" : "Start"}
      </button>

      {/* Penalty counters */}
      {penalties && Object.entries(penalties).map(([key, sek]) => (
        <div key={key} className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg">
          <div>
            <p className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</p>
            <p className="text-xs text-zinc-500">+{sek}s pro Vergehen</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPenalty(key, Math.max(0, (Number(rohdaten[key]) || 0) - 1))}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition"
            >
              -
            </button>
            <span className="w-8 text-center font-mono text-lg">{Number(rohdaten[key]) || 0}</span>
            <button
              onClick={() => onPenalty(key, (Number(rohdaten[key]) || 0) + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-zinc-700 text-white hover:bg-zinc-800 transition"
            >
              +
            </button>
          </div>
        </div>
      ))}
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

  // Rohdaten for each team (indexed by ergebnis.id)
  const [rohdatenMap, setRohdatenMap] = useState<Record<string, Record<string, unknown>>>({});

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

        // Fetch slot end time if slotId provided
        if (slotId) {
          // We don't have a direct slot endpoint, so we skip or parse from schedule
          // For now, we'll leave slotEndZeit undefined unless we can get it
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
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Lade Partie...
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400 text-sm">{error ?? "Game nicht gefunden"}</p>
        <Link href="/referee" className="text-sm text-zinc-400 hover:text-white transition">
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

  // ─── Render ───

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <Link href="/referee" className="text-xs text-zinc-500 hover:text-white transition">
          &larr; Übersicht
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">{game.name}</h1>
        <p className="text-sm text-zinc-400">
          {isDuell
            ? ergebnisse.map((e) => e.team.name).join(" vs. ")
            : ergebnisse[0]?.team.name ?? "Partie"}
        </p>
      </div>

      {/* Timer */}
      <div className="border border-zinc-800 rounded-lg bg-zinc-900/50">
        <GameTimer startTime={startTime} slotEndZeit={slotEndZeit} />
      </div>

      {/* Game-specific tools */}
      {wl && (
        <div className="space-y-4">
          {/* PUNKTE_DUELL: Two score counters side by side */}
          {wl.typ === "punkte_duell" && isDuell && (
            <div className="flex gap-3">
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
            <div key={e.id} className="space-y-3">
              {isDuell && (
                <p className="text-sm font-medium text-zinc-400">{e.team.name}</p>
              )}
              <Stopwatch
                onTimeRecorded={(sek) => updateRohdaten(e.id, "zeit_sekunden", sek)}
                penalties={wl.strafen}
                rohdaten={rohdatenMap[e.id] ?? {}}
                onPenalty={(key, val) => updateRohdaten(e.id, key, val)}
              />
              {wl.nicht_geschafft && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateRohdaten(e.id, "nicht_geschafft", false)}
                    className={`flex-1 py-3 rounded-lg text-sm font-medium border transition ${
                      (rohdatenMap[e.id] ?? {}).nicht_geschafft !== true
                        ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                        : "border-zinc-700 text-zinc-400"
                    }`}
                  >
                    Geschafft
                  </button>
                  <button
                    onClick={() => updateRohdaten(e.id, "nicht_geschafft", true)}
                    className={`flex-1 py-3 rounded-lg text-sm font-medium border transition ${
                      (rohdatenMap[e.id] ?? {}).nicht_geschafft === true
                        ? "bg-red-900/60 border-red-700 text-red-300"
                        : "border-zinc-700 text-zinc-400"
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
              <div key={e.id} className="space-y-2">
                {isDuell && (
                  <p className="text-sm font-medium text-zinc-400">{e.team.name}</p>
                )}
                <label className="text-xs text-zinc-500">{field.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={(rd[field.name] as string) ?? ""}
                  onChange={(ev) => updateRohdaten(e.id, field.name, Number(ev.target.value) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-4 text-3xl font-mono text-center focus:outline-none focus:border-zinc-500"
                  placeholder="0"
                />
              </div>
            );
          })}

          {/* FORMEL: Multiple number inputs */}
          {wl.typ === "formel" && ergebnisse.map((e) => {
            const rd = rohdatenMap[e.id] ?? {};
            return (
              <div key={e.id} className="space-y-3">
                {isDuell && (
                  <p className="text-sm font-medium text-zinc-400">{e.team.name}</p>
                )}
                {wl.eingabefelder?.map((f) => (
                  <div key={f.name} className="space-y-1">
                    <label className="text-xs text-zinc-500">{f.label}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={(rd[f.name] as string) ?? ""}
                      onChange={(ev) => updateRohdaten(e.id, f.name, Number(ev.target.value) || 0)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-xl font-mono focus:outline-none focus:border-zinc-500"
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
              <div key={e.id} className="space-y-3">
                {isDuell && (
                  <p className="text-sm font-medium text-zinc-400">{e.team.name}</p>
                )}
                <label className="text-xs text-zinc-500">Schwierigkeit</label>
                <div className="grid grid-cols-2 gap-2">
                  {wl.levels?.map((l) => (
                    <button
                      key={l.name}
                      onClick={() => updateRohdaten(e.id, "level", l.name)}
                      className={`py-4 rounded-lg text-sm font-medium border transition ${
                        rd.level === l.name
                          ? "bg-white text-black border-white"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {l.name}
                      <span className="block text-xs mt-0.5 opacity-70">{l.grundpunkte} Punkte</span>
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
              <div key={e.id} className="space-y-4">
                {isDuell && (
                  <p className="text-sm font-medium text-zinc-400">{e.team.name}</p>
                )}

                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Wahl</label>
                  <div className="grid grid-cols-2 gap-2">
                    {wl.optionen?.map((o) => (
                      <button
                        key={o.name}
                        onClick={() => updateRohdaten(e.id, "option", o.name)}
                        className={`py-4 rounded-lg text-sm font-medium border transition ${
                          rd.option === o.name
                            ? "bg-white text-black border-white"
                            : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        {o.name}
                        <span className="block text-xs mt-0.5 opacity-70">{o.punkte_erfolg}P</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Erfolg?</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateRohdaten(e.id, "erfolg", true)}
                      className={`flex-1 py-4 rounded-lg text-sm font-medium border transition ${
                        rd.erfolg === true
                          ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                          : "border-zinc-700 text-zinc-400"
                      }`}
                    >
                      Ja
                    </button>
                    <button
                      onClick={() => updateRohdaten(e.id, "erfolg", false)}
                      className={`flex-1 py-4 rounded-lg text-sm font-medium border transition ${
                        rd.erfolg === false
                          ? "bg-red-900/60 border-red-700 text-red-300"
                          : "border-zinc-700 text-zinc-400"
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
      )}

      {/* Bottom action button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-sm">
        <button
          onClick={handleErgebnisEintragen}
          disabled={!hasMinimumData()}
          className="w-full py-4 bg-white text-black text-lg font-semibold rounded-lg hover:bg-zinc-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Ergebnis eintragen
        </button>
      </div>
    </div>
  );
}
