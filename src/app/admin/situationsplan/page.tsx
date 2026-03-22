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

const MODUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SOLO: { bg: "bg-emerald-900/80", border: "border-emerald-600", text: "text-emerald-200" },
  DUELL: { bg: "bg-blue-900/80", border: "border-blue-600", text: "text-blue-200" },
};

export default function SituationsplanPage() {
  const [plan, setPlan] = useState<Situationsplan | null>(null);
  const [allGames, setAllGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [addingInfra, setAddingInfra] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Platzierte Game-IDs
  const placedGameIds = new Set(plan?.gamePositionen.map((p) => p.gameId) ?? []);
  const unplacedGames = allGames.filter((g) => !placedGameIds.has(g.id));

  const savePosition = useCallback(
    async (gameId: string, x: number, y: number) => {
      if (!plan) return;
      await fetch("/api/situationsplan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, gameId, x, y }),
      });
    },
    [plan]
  );

  const handleMouseDown = (e: React.MouseEvent, gameId: string) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pos = plan?.gamePositionen.find((p) => p.gameId === gameId);
    if (!pos) return;

    const containerX = (pos.x / 100) * rect.width;
    const containerY = (pos.y / 100) * rect.height;

    setDragOffset({
      x: e.clientX - rect.left - containerX,
      y: e.clientY - rect.top - containerY,
    });
    setDragging(gameId);
    setSelectedGame(gameId);
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

  const handleMouseUp = useCallback(() => {
    if (dragging && plan) {
      const pos = plan.gamePositionen.find((p) => p.gameId === dragging);
      if (pos) savePosition(dragging, pos.x, pos.y);
    }
    setDragging(null);
  }, [dragging, plan, savePosition]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Neues Game auf die Karte setzen
  const handlePlaceGame = async (gameId: string) => {
    if (!plan) return;
    const x = 50;
    const y = 50;
    await fetch("/api/situationsplan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, gameId, x, y }),
    });
    // Reload
    const updated = await fetch("/api/situationsplan").then((r) => r.json());
    setPlan(updated);
  };

  // Infrastruktur hinzufügen
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

    const updated = await fetch("/api/situationsplan").then((r) => r.json());
    setPlan(updated);
    setAddingInfra(null);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade Situationsplan...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Situationsplan</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-emerald-900/60 text-emerald-300">Solo</span>
          <span className="px-2 py-1 rounded bg-blue-900/60 text-blue-300">Duell</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_240px] gap-4">
        {/* Karte */}
        <div
          ref={containerRef}
          className={`relative border border-zinc-800 rounded-lg overflow-hidden select-none ${
            addingInfra ? "cursor-crosshair" : ""
          }`}
          onClick={handleMapClick}
          style={{ aspectRatio: "4/3" }}
        >
          {/* Hintergrundbild */}
          <img
            src="/images/situationsplan.jpg"
            alt="Situationsplan"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />

          {/* Game-Positionen */}
          {plan?.gamePositionen.map((pos) => {
            const colors = MODUS_COLORS[pos.game.modus] ?? MODUS_COLORS.SOLO;
            const isSelected = selectedGame === pos.gameId;
            return (
              <div
                key={pos.id}
                onMouseDown={(e) => handleMouseDown(e, pos.gameId)}
                onClick={(e) => { e.stopPropagation(); setSelectedGame(pos.gameId); }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-md border text-xs font-medium whitespace-nowrap backdrop-blur-sm transition-shadow ${
                  colors.bg
                } ${colors.border} ${colors.text} ${
                  isSelected ? "ring-2 ring-white/60 z-20" : "z-10"
                } ${dragging === pos.gameId ? "opacity-80 scale-105" : "hover:ring-1 hover:ring-white/30"}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  cursor: dragging === pos.gameId ? "grabbing" : "grab",
                }}
              >
                {pos.game.name}
                {pos.game.flaecheLaengeM && pos.game.flaecheBreiteM && (
                  <span className="ml-1 opacity-60">
                    {pos.game.flaecheLaengeM}×{pos.game.flaecheBreiteM}
                  </span>
                )}
                {pos.game.stromNoetig && <span className="ml-1">⚡</span>}
              </div>
            );
          })}

          {/* Infrastruktur-Elemente */}
          {plan?.infrastruktur.map((el) => (
            <div
              key={el.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 text-lg cursor-default"
              style={{ left: `${el.x}%`, top: `${el.y}%` }}
              title={el.label ?? el.typ}
            >
              {INFRA_ICONS[el.typ] ?? "📍"}
            </div>
          ))}

          {/* Crosshair Info */}
          {addingInfra && (
            <div className="absolute top-2 left-2 bg-zinc-900/90 text-xs text-amber-300 px-2 py-1 rounded z-30">
              Klicke auf die Karte um {addingInfra} zu platzieren
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Unplatzierte Games */}
          <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Nicht platziert ({unplacedGames.length})
            </h3>
            {unplacedGames.length === 0 ? (
              <p className="text-xs text-zinc-600">Alle Games platziert</p>
            ) : (
              <div className="space-y-1">
                {unplacedGames.map((g) => {
                  const colors = MODUS_COLORS[g.modus] ?? MODUS_COLORS.SOLO;
                  return (
                    <button
                      key={g.id}
                      onClick={() => handlePlaceGame(g.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs border transition hover:opacity-80 ${colors.bg} ${colors.border} ${colors.text}`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Infrastruktur hinzufügen */}
          <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Infrastruktur
            </h3>
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

          {/* Ausgewähltes Game Detail */}
          {selectedGame && plan && (() => {
            const pos = plan.gamePositionen.find((p) => p.gameId === selectedGame);
            if (!pos) return null;
            return (
              <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Details
                </h3>
                <p className="text-sm font-medium">{pos.game.name}</p>
                <div className="text-xs text-zinc-400 space-y-1">
                  <p>Modus: {pos.game.modus === "DUELL" ? "Duell" : "Solo"}</p>
                  {pos.game.flaecheLaengeM && pos.game.flaecheBreiteM && (
                    <p>Fläche: {pos.game.flaecheLaengeM} × {pos.game.flaecheBreiteM}m</p>
                  )}
                  <p>Helfer: {pos.game.helferAnzahl}</p>
                  {pos.game.stromNoetig && <p className="text-amber-400">⚡ Strom benötigt</p>}
                  <p className="text-zinc-600">
                    Position: {pos.x.toFixed(1)}%, {pos.y.toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
