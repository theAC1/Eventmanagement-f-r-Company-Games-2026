"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type GameInfo = {
  id: string;
  name: string;
  slug: string;
  modus: string;
  flaecheLaengeM: number | null;
  flaecheBreiteM: number | null;
  helferAnzahl: number;
  stromNoetig: boolean;
};

type GamePosition = {
  id: string;
  gameId: string;
  x: number;
  y: number;
  rotation: number;
  game: GameInfo;
};

type InfraElement = {
  id: string;
  typ: string;
  label: string | null;
  x: number;
  y: number;
};

type Situationsplan = {
  id: string;
  name: string;
  gamePositionen: GamePosition[];
  infrastruktur: InfraElement[];
};

const INFRA_ICONS: Record<string, string> = {
  STROM: "⚡",
  WASSER: "💧",
  WEG: "🚶",
  PARKPLATZ: "🅿️",
  ZUSCHAUER: "👥",
  SANITAER: "🚻",
  SONSTIGES: "📍",
};

const MODUS_COLORS: Record<string, { bg: string; border: string }> = {
  SOLO: { bg: "rgba(6, 78, 59, 0.75)", border: "rgba(16, 185, 129, 0.8)" },
  DUELL: { bg: "rgba(30, 58, 138, 0.75)", border: "rgba(59, 130, 246, 0.8)" },
};

const MODUS_TW: Record<string, { bg: string; border: string; text: string }> = {
  SOLO: { bg: "bg-emerald-900/80", border: "border-emerald-600", text: "text-emerald-200" },
  DUELL: { bg: "bg-blue-900/80", border: "border-blue-600", text: "text-blue-200" },
};

// ─── Massstab: Referenzgebäude = 105m ───
// Bild: 2078×1342px. Gebäude erstreckt sich ca. von x=0% bis x=65% der Bildbreite
// → 65% der Bildbreite ≈ 105m → 1% Bildbreite ≈ 1.615m
// Anpassbar über die UI
const DEFAULT_METERS_PER_PERCENT_X = 1.615;

export default function SituationsplanPage() {
  const [plan, setPlan] = useState<Situationsplan | null>(null);
  const [allGames, setAllGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [selectedInfra, setSelectedInfra] = useState<string | null>(null);
  const [addingInfra, setAddingInfra] = useState<string | null>(null);
  const [metersPerPct, setMetersPerPct] = useState(DEFAULT_METERS_PER_PERCENT_X);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bild-Seitenverhältnis: 2078/1342 ≈ 1.549
  const IMG_RATIO = 2078 / 1342;

  const reload = useCallback(async () => {
    const updated = await fetch("/api/situationsplan").then((r) => r.json());
    setPlan(updated);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/situationsplan").then((r) => r.json()),
      fetch("/api/games").then((r) => r.json()),
    ]).then(([p, g]) => {
      setPlan(p);
      setAllGames(g);
      setLoading(false);
    });
  }, []);

  const placedGameIds = new Set(plan?.gamePositionen.map((p) => p.gameId) ?? []);
  const unplacedGames = allGames.filter((g) => !placedGameIds.has(g.id));

  // ─── Massstab-Berechnung ───
  // Berechne Pixelgrösse eines Game-Feldes in % des Containers
  const getFieldSize = (game: GameInfo, rotation: number) => {
    const l = game.flaecheLaengeM ?? 10;
    const b = game.flaecheBreiteM ?? 10;
    // Bei 90° oder 270° Rotation: Länge/Breite tauschen
    const isRotated = rotation === 90 || rotation === 270;
    const widthM = isRotated ? b : l;
    const heightM = isRotated ? l : b;
    const widthPct = widthM / metersPerPct;
    const heightPct = (heightM / metersPerPct) * IMG_RATIO; // Y-Achse korrigieren für Seitenverhältnis
    return { widthPct, heightPct };
  };

  // ─── Drag & Drop ───
  const handleMouseDown = (e: React.MouseEvent, gameId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pos = plan?.gamePositionen.find((p) => p.gameId === gameId);
    if (!pos) return;

    setDragOffset({
      x: e.clientX - rect.left - (pos.x / 100) * rect.width,
      y: e.clientY - rect.top - (pos.y / 100) * rect.height,
    });
    setDragging(gameId);
    setSelectedGame(gameId);
    setSelectedInfra(null);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current || !plan) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100));
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          gamePositionen: prev.gamePositionen.map((p) =>
            p.gameId === dragging ? { ...p, x, y } : p
          ),
        };
      });
    },
    [dragging, dragOffset]
  );

  const handleMouseUp = useCallback(async () => {
    if (dragging && plan) {
      const pos = plan.gamePositionen.find((p) => p.gameId === dragging);
      if (pos) {
        await fetch(`/api/situationsplan/position/${pos.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: pos.x, y: pos.y, rotation: pos.rotation }),
        });
      }
    }
    setDragging(null);
  }, [dragging, plan]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─── Actions ───
  const handlePlaceGame = async (gameId: string) => {
    if (!plan) return;
    await fetch("/api/situationsplan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, gameId, x: 50, y: 50 }),
    });
    await reload();
  };

  const handleRotate = async (posId: string, currentRotation: number) => {
    const newRotation = (currentRotation + 45) % 360;
    await fetch(`/api/situationsplan/position/${posId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...plan?.gamePositionen.find((p) => p.id === posId),
        rotation: newRotation,
      }),
    });
    await reload();
  };

  const handleDeletePosition = async (posId: string) => {
    await fetch(`/api/situationsplan/position/${posId}`, { method: "DELETE" });
    setSelectedGame(null);
    await reload();
  };

  const handleDeleteInfra = async (infraId: string) => {
    await fetch(`/api/situationsplan/infra/${infraId}`, { method: "DELETE" });
    setSelectedInfra(null);
    await reload();
  };

  const handleMapClick = async (e: React.MouseEvent) => {
    if (!addingInfra || !plan || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    await fetch("/api/situationsplan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, typ: addingInfra, x, y }),
    });
    await reload();
    setAddingInfra(null);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade Situationsplan...</div>;

  const selectedPos = selectedGame ? plan?.gamePositionen.find((p) => p.gameId === selectedGame) : null;
  const selectedInfraEl = selectedInfra ? plan?.infrastruktur.find((e) => e.id === selectedInfra) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Situationsplan</h1>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2 py-1 rounded bg-emerald-900/60 text-emerald-300">Solo</span>
          <span className="px-2 py-1 rounded bg-blue-900/60 text-blue-300">Duell</span>
          <span className="text-zinc-600">|</span>
          <label className="text-zinc-500">Massstab:</label>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="5"
            value={metersPerPct}
            onChange={(e) => setMetersPerPct(parseFloat(e.target.value) || DEFAULT_METERS_PER_PERCENT_X)}
            className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-center"
          />
          <span className="text-zinc-600">m/%</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_240px] gap-4">
        {/* Karte */}
        <div
          ref={containerRef}
          className={`relative border border-zinc-800 rounded-lg overflow-hidden select-none ${
            addingInfra ? "cursor-crosshair" : ""
          }`}
          onClick={(e) => {
            if (addingInfra) { handleMapClick(e); return; }
            setSelectedGame(null);
            setSelectedInfra(null);
          }}
          style={{ aspectRatio: `${IMG_RATIO}` }}
        >
          <img
            src="/images/situationsplan.jpg"
            alt="Situationsplan"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />

          {/* Game-Felder (massstabsgetreu) */}
          {plan?.gamePositionen.map((pos) => {
            const colors = MODUS_COLORS[pos.game.modus] ?? MODUS_COLORS.SOLO;
            const isSelected = selectedGame === pos.gameId;
            const { widthPct, heightPct } = getFieldSize(pos.game, pos.rotation);
            const needsRotateCSS = pos.rotation % 90 !== 0 && pos.rotation !== 0;

            return (
              <div
                key={pos.id}
                onMouseDown={(e) => handleMouseDown(e, pos.gameId)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGame(pos.gameId);
                  setSelectedInfra(null);
                }}
                className={`absolute flex items-center justify-center text-[10px] font-medium text-white/90 backdrop-blur-[2px] rounded-sm ${
                  isSelected ? "ring-2 ring-white/70 z-20" : "z-10"
                } ${dragging === pos.gameId ? "opacity-70" : "hover:ring-1 hover:ring-white/40"}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transform: `translate(-50%, -50%)${needsRotateCSS ? ` rotate(${pos.rotation}deg)` : ""}`,
                  backgroundColor: colors.bg,
                  border: `1.5px solid ${colors.border}`,
                  cursor: dragging === pos.gameId ? "grabbing" : "grab",
                }}
              >
                <span className="truncate px-1">
                  {pos.game.name}
                  {pos.game.stromNoetig ? " ⚡" : ""}
                </span>
              </div>
            );
          })}

          {/* Infrastruktur */}
          {plan?.infrastruktur.map((el) => (
            <div
              key={el.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedInfra(el.id);
                setSelectedGame(null);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 text-lg cursor-pointer ${
                selectedInfra === el.id ? "ring-2 ring-white/60 rounded-full" : ""
              }`}
              style={{ left: `${el.x}%`, top: `${el.y}%` }}
              title={el.label ?? el.typ}
            >
              {INFRA_ICONS[el.typ] ?? "📍"}
            </div>
          ))}

          {addingInfra && (
            <div className="absolute top-2 left-2 bg-zinc-900/90 text-xs text-amber-300 px-2 py-1 rounded z-30">
              Klicke um {addingInfra.toLowerCase()} zu platzieren &middot;{" "}
              <button onClick={(e) => { e.stopPropagation(); setAddingInfra(null); }} className="underline">
                Abbrechen
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          {/* Unplatzierte Games */}
          <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Nicht platziert ({unplacedGames.length})
            </h3>
            {unplacedGames.length === 0 ? (
              <p className="text-xs text-zinc-600">Alle platziert</p>
            ) : (
              <div className="space-y-1">
                {unplacedGames.map((g) => {
                  const tw = MODUS_TW[g.modus] ?? MODUS_TW.SOLO;
                  return (
                    <button
                      key={g.id}
                      onClick={() => handlePlaceGame(g.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs border transition hover:opacity-80 ${tw.bg} ${tw.border} ${tw.text}`}
                    >
                      {g.name}
                      {g.flaecheLaengeM && g.flaecheBreiteM && (
                        <span className="opacity-60 ml-1">
                          {g.flaecheLaengeM}x{g.flaecheBreiteM}m
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Infrastruktur */}
          <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Infrastruktur</h3>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(INFRA_ICONS).map(([typ, icon]) => (
                <button
                  key={typ}
                  onClick={() => setAddingInfra(addingInfra === typ ? null : typ)}
                  className={`px-2 py-1.5 rounded text-xs border transition ${
                    addingInfra === typ
                      ? "bg-amber-900/40 border-amber-700 text-amber-300"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {icon} {typ.charAt(0) + typ.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Detail-Panel: Game */}
          {selectedPos && (
            <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Details</h3>
              <p className="text-sm font-medium">{selectedPos.game.name}</p>
              <div className="text-xs text-zinc-400 space-y-1">
                <p>Modus: {selectedPos.game.modus === "DUELL" ? "Duell" : "Solo"}</p>
                {selectedPos.game.flaecheLaengeM && selectedPos.game.flaecheBreiteM && (
                  <p>Fläche: {selectedPos.game.flaecheLaengeM} × {selectedPos.game.flaecheBreiteM}m</p>
                )}
                <p>Helfer: {selectedPos.game.helferAnzahl}</p>
                {selectedPos.game.stromNoetig && <p className="text-amber-400">⚡ Strom benötigt</p>}
                <p className="text-zinc-600">Rotation: {selectedPos.rotation}°</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRotate(selectedPos.id, selectedPos.rotation)}
                  className="flex-1 px-2 py-1.5 text-xs border border-zinc-700 rounded hover:bg-zinc-800 transition"
                >
                  ↻ +45°
                </button>
                <button
                  onClick={() => handleDeletePosition(selectedPos.id)}
                  className="flex-1 px-2 py-1.5 text-xs border border-red-900 text-red-400 rounded hover:bg-red-950 transition"
                >
                  Entfernen
                </button>
              </div>
            </div>
          )}

          {/* Detail-Panel: Infrastruktur */}
          {selectedInfraEl && (
            <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Infrastruktur</h3>
              <p className="text-sm">
                {INFRA_ICONS[selectedInfraEl.typ]} {selectedInfraEl.typ}
                {selectedInfraEl.label && ` – ${selectedInfraEl.label}`}
              </p>
              <button
                onClick={() => handleDeleteInfra(selectedInfraEl.id)}
                className="w-full px-2 py-1.5 text-xs border border-red-900 text-red-400 rounded hover:bg-red-950 transition"
              >
                Löschen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
