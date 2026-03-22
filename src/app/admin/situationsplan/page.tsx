"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type GameInfo = {
  id: string; name: string; slug: string; modus: string;
  flaecheLaengeM: number | null; flaecheBreiteM: number | null;
  helferAnzahl: number; stromNoetig: boolean;
};

type GamePosition = {
  id: string; gameId: string; x: number; y: number; rotation: number;
  nummer: string; oeffentlich: boolean; game: GameInfo;
};

type CustomFeld = {
  id: string; label: string; nummer: string; farbe: string;
  breiteM: number; laengeM: number; x: number; y: number;
  rotation: number; oeffentlich: boolean;
};

type InfraElement = {
  id: string; typ: string; label: string | null; x: number; y: number; oeffentlich: boolean;
};

type Plan = {
  id: string; name: string;
  gamePositionen: GamePosition[];
  customFelder: CustomFeld[];
  infrastruktur: InfraElement[];
};

const INFRA_ICONS: Record<string, string> = {
  STROM: "⚡", WASSER: "💧", WEG: "🚶", PARKPLATZ: "🅿️",
  ZUSCHAUER: "👥", SANITAER: "🚻", SONSTIGES: "📍",
};

const MODUS_BG: Record<string, string> = {
  SOLO: "rgba(6,78,59,0.75)", DUELL: "rgba(30,58,138,0.75)",
};
const MODUS_BORDER: Record<string, string> = {
  SOLO: "rgba(16,185,129,0.8)", DUELL: "rgba(59,130,246,0.8)",
};
const MODUS_TW: Record<string, string> = {
  SOLO: "bg-emerald-900/80 border-emerald-600 text-emerald-200",
  DUELL: "bg-blue-900/80 border-blue-600 text-blue-200",
};

const DEFAULT_MPP = 1.615;
const IMG_RATIO = 2078 / 1342;

export default function SituationsplanPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allGames, setAllGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<{ type: "game" | "custom"; id: string } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<{ type: "game" | "custom" | "infra"; id: string } | null>(null);
  const [addingInfra, setAddingInfra] = useState<string | null>(null);
  const [mpp, setMpp] = useState(DEFAULT_MPP);
  const ref = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const p = await fetch("/api/situationsplan").then(r => r.json());
    setPlan(p);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/situationsplan").then(r => r.json()),
      fetch("/api/games").then(r => r.json()),
    ]).then(([p, g]) => { setPlan(p); setAllGames(g); setLoading(false); });
  }, []);

  const placedIds = new Set(plan?.gamePositionen.map(p => p.gameId) ?? []);
  const unplaced = allGames.filter(g => !placedIds.has(g.id));

  // ─── Feld-Grösse ───
  const fieldSize = (lM: number, bM: number, rot: number) => {
    const r90 = rot === 90 || rot === 270;
    const w = r90 ? bM : lM;
    const h = r90 ? lM : bM;
    return { wPct: w / mpp, hPct: (h / mpp) * IMG_RATIO };
  };

  // ─── Drag ───
  const startDrag = (e: React.MouseEvent, type: "game" | "custom", id: string, xPct: number, yPct: number) => {
    e.preventDefault(); e.stopPropagation();
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setDragOffset({
      x: e.clientX - rect.left - (xPct / 100) * rect.width,
      y: e.clientY - rect.top - (yPct / 100) * rect.height,
    });
    setDragging({ type, id });
    setSelected({ type, id });
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !ref.current || !plan) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100));
    setPlan(prev => {
      if (!prev) return prev;
      if (dragging.type === "game") {
        return { ...prev, gamePositionen: prev.gamePositionen.map(p => p.gameId === dragging.id ? { ...p, x, y } : p) };
      }
      return { ...prev, customFelder: prev.customFelder.map(f => f.id === dragging.id ? { ...f, x, y } : f) };
    });
  }, [dragging, dragOffset]);

  const onMouseUp = useCallback(async () => {
    if (!dragging || !plan) { setDragging(null); return; }
    if (dragging.type === "game") {
      const pos = plan.gamePositionen.find(p => p.gameId === dragging.id);
      if (pos) await fetch(`/api/situationsplan/position/${pos.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: pos.x, y: pos.y, rotation: pos.rotation }),
      });
    } else {
      const cf = plan.customFelder.find(f => f.id === dragging.id);
      if (cf) await fetch(`/api/situationsplan/custom/${cf.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cf),
      });
    }
    setDragging(null);
  }, [dragging, plan]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  // ─── Actions ───
  const placeGame = async (gameId: string) => {
    if (!plan) return;
    await fetch("/api/situationsplan", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, gameId, x: 50, y: 50 }),
    });
    await reload();
  };

  const addCustom = async () => {
    if (!plan) return;
    await fetch("/api/situationsplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "custom", planId: plan.id, label: "Neues Feld", farbe: "#6b7280" }),
    });
    await reload();
  };

  const rotate = async (type: "game" | "custom", id: string, current: number) => {
    const newRot = (current + 45) % 360;
    if (type === "game") {
      const pos = plan?.gamePositionen.find(p => p.gameId === id);
      if (!pos) return;
      await fetch(`/api/situationsplan/position/${pos.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: pos.x, y: pos.y, rotation: newRot }),
      });
    } else {
      const cf = plan?.customFelder.find(f => f.id === id);
      if (!cf) return;
      await fetch(`/api/situationsplan/custom/${cf.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cf, rotation: newRot }),
      });
    }
    await reload();
  };

  const updateGamePos = async (posId: string, data: Partial<GamePosition>) => {
    await fetch(`/api/situationsplan/position/${posId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await reload();
  };

  const updateCustom = async (cfId: string, data: Partial<CustomFeld>) => {
    const cf = plan?.customFelder.find(f => f.id === cfId);
    if (!cf) return;
    await fetch(`/api/situationsplan/custom/${cfId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cf, ...data }),
    });
    await reload();
  };

  const deleteItem = async (type: "game" | "custom" | "infra", id: string) => {
    const url = type === "game" ? `/api/situationsplan/position/${id}`
      : type === "custom" ? `/api/situationsplan/custom/${id}`
      : `/api/situationsplan/infra/${id}`;
    await fetch(url, { method: "DELETE" });
    setSelected(null);
    await reload();
  };

  const addInfra = async (e: React.MouseEvent) => {
    if (!addingInfra || !plan || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    await fetch("/api/situationsplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, typ: addingInfra, x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 }),
    });
    await reload();
    setAddingInfra(null);
  };

  // ─── Export ───
  const exportImage = async () => {
    if (!ref.current) return;
    try {
      // Dynamischer Import – html2canvas muss installiert sein
      // Falls nicht verfügbar: Fallback auf Screenshot-Hinweis
      const mod = await import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js" as string);
      const html2canvas = mod.default;
      const canvas = await html2canvas(ref.current, { useCORS: true, scale: 2 });
      const link = document.createElement("a");
      link.download = "situationsplan-export.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert("Export: Bitte mache einen Screenshot (Ctrl+Shift+S) oder installiere html2canvas via npm.");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;

  const selGame = selected?.type === "game" ? plan?.gamePositionen.find(p => p.gameId === selected.id) : null;
  const selCustom = selected?.type === "custom" ? plan?.customFelder.find(f => f.id === selected.id) : null;
  const selInfra = selected?.type === "infra" ? plan?.infrastruktur.find(e => e.id === selected.id) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Situationsplan</h1>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2 py-1 rounded bg-emerald-900/60 text-emerald-300">Solo</span>
          <span className="px-2 py-1 rounded bg-blue-900/60 text-blue-300">Duell</span>
          <span className="text-zinc-600">|</span>
          <label className="text-zinc-500">m/%:</label>
          <input type="number" step="0.1" min="0.5" max="5" value={mpp}
            onChange={e => setMpp(parseFloat(e.target.value) || DEFAULT_MPP)}
            className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-center" />
          <button onClick={exportImage}
            className="px-3 py-1 border border-zinc-700 rounded hover:bg-zinc-800 transition">
            Export PNG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-4">
        {/* ── Canvas ── */}
        <div ref={ref}
          className={`relative border border-zinc-800 rounded-lg overflow-hidden select-none ${addingInfra ? "cursor-crosshair" : ""}`}
          onClick={e => { if (addingInfra) { addInfra(e); return; } setSelected(null); }}
          style={{ aspectRatio: `${IMG_RATIO}` }}>

          <img src="/images/situationsplan.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />

          {/* Game-Felder */}
          {plan?.gamePositionen.map(pos => {
            const s = fieldSize(pos.game.flaecheLaengeM ?? 10, pos.game.flaecheBreiteM ?? 10, pos.rotation);
            const isSel = selected?.type === "game" && selected.id === pos.gameId;
            const r45 = pos.rotation % 90 !== 0;
            return (
              <div key={pos.id}
                onMouseDown={e => startDrag(e, "game", pos.gameId, pos.x, pos.y)}
                onClick={e => { e.stopPropagation(); setSelected({ type: "game", id: pos.gameId }); }}
                className={`absolute flex items-center justify-center text-xs font-bold text-white/90 rounded-sm backdrop-blur-[2px] ${isSel ? "ring-2 ring-white/70 z-20" : "z-10 hover:ring-1 hover:ring-white/40"}`}
                style={{
                  left: `${pos.x}%`, top: `${pos.y}%`, width: `${s.wPct}%`, height: `${s.hPct}%`,
                  transform: `translate(-50%,-50%)${r45 ? ` rotate(${pos.rotation}deg)` : ""}`,
                  backgroundColor: MODUS_BG[pos.game.modus] ?? MODUS_BG.SOLO,
                  border: `1.5px solid ${MODUS_BORDER[pos.game.modus] ?? MODUS_BORDER.SOLO}`,
                  cursor: dragging?.id === pos.gameId ? "grabbing" : "grab",
                  opacity: pos.oeffentlich ? 1 : 0.5,
                }}>
                {pos.nummer || pos.game.name.charAt(0)}
              </div>
            );
          })}

          {/* Custom-Felder */}
          {plan?.customFelder.map(cf => {
            const s = fieldSize(cf.laengeM, cf.breiteM, cf.rotation);
            const isSel = selected?.type === "custom" && selected.id === cf.id;
            const r45 = cf.rotation % 90 !== 0;
            return (
              <div key={cf.id}
                onMouseDown={e => startDrag(e, "custom", cf.id, cf.x, cf.y)}
                onClick={e => { e.stopPropagation(); setSelected({ type: "custom", id: cf.id }); }}
                className={`absolute flex items-center justify-center text-xs font-bold text-white/90 rounded-sm backdrop-blur-[2px] ${isSel ? "ring-2 ring-white/70 z-20" : "z-10 hover:ring-1 hover:ring-white/40"}`}
                style={{
                  left: `${cf.x}%`, top: `${cf.y}%`, width: `${s.wPct}%`, height: `${s.hPct}%`,
                  transform: `translate(-50%,-50%)${r45 ? ` rotate(${cf.rotation}deg)` : ""}`,
                  backgroundColor: cf.farbe + "cc",
                  border: `1.5px solid ${cf.farbe}`,
                  cursor: dragging?.id === cf.id ? "grabbing" : "grab",
                  opacity: cf.oeffentlich ? 1 : 0.5,
                }}>
                {cf.nummer || cf.label.charAt(0)}
              </div>
            );
          })}

          {/* Infrastruktur */}
          {plan?.infrastruktur.map(el => (
            <div key={el.id}
              onClick={e => { e.stopPropagation(); setSelected({ type: "infra", id: el.id }); }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 text-lg cursor-pointer ${selected?.type === "infra" && selected.id === el.id ? "ring-2 ring-white/60 rounded-full" : ""}`}
              style={{ left: `${el.x}%`, top: `${el.y}%`, opacity: el.oeffentlich ? 1 : 0.4 }}
              title={el.label ?? el.typ}>
              {INFRA_ICONS[el.typ] ?? "📍"}
            </div>
          ))}

          {addingInfra && (
            <div className="absolute top-2 left-2 bg-zinc-900/90 text-xs text-amber-300 px-2 py-1 rounded z-30">
              Klicke um {addingInfra.toLowerCase()} zu platzieren &middot;{" "}
              <button onClick={e => { e.stopPropagation(); setAddingInfra(null); }} className="underline">Abbrechen</button>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto text-xs">

          {/* Legende: Platzierte Games */}
          {plan && plan.gamePositionen.length > 0 && (
            <div className="border border-zinc-800 rounded-lg p-3 space-y-1.5">
              <h3 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Legende – Games</h3>
              {plan.gamePositionen.map(pos => (
                <div key={pos.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selected?.type === "game" && selected.id === pos.gameId ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
                  onClick={() => setSelected({ type: "game", id: pos.gameId })}>
                  <div className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: MODUS_BG[pos.game.modus], border: `1px solid ${MODUS_BORDER[pos.game.modus]}` }}>
                    {pos.nummer || "–"}
                  </div>
                  <span className="flex-1 truncate">{pos.game.name}</span>
                  {!pos.oeffentlich && <span className="text-zinc-600">OKW</span>}
                </div>
              ))}
            </div>
          )}

          {/* Legende: Custom-Felder */}
          {plan && plan.customFelder.length > 0 && (
            <div className="border border-zinc-800 rounded-lg p-3 space-y-1.5">
              <h3 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Legende – Custom</h3>
              {plan.customFelder.map(cf => (
                <div key={cf.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selected?.type === "custom" && selected.id === cf.id ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
                  onClick={() => setSelected({ type: "custom", id: cf.id })}>
                  <div className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: cf.farbe }}>
                    {cf.nummer || "–"}
                  </div>
                  <span className="flex-1 truncate">{cf.label}</span>
                  {!cf.oeffentlich && <span className="text-zinc-600">OKW</span>}
                </div>
              ))}
            </div>
          )}

          {/* Unplatzierte Games */}
          <div className="border border-zinc-800 rounded-lg p-3 space-y-1.5">
            <h3 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Nicht platziert ({unplaced.length})</h3>
            {unplaced.length === 0 ? <p className="text-zinc-600">Alle platziert</p> : (
              <div className="space-y-1">
                {unplaced.map(g => (
                  <button key={g.id} onClick={() => placeGame(g.id)}
                    className={`w-full text-left px-2 py-1 rounded border transition hover:opacity-80 ${MODUS_TW[g.modus] ?? MODUS_TW.SOLO}`}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom-Feld hinzufügen */}
          <button onClick={addCustom}
            className="w-full px-3 py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-400 hover:border-zinc-500 hover:text-white transition">
            + Custom-Feld
          </button>

          {/* Infrastruktur */}
          <div className="border border-zinc-800 rounded-lg p-3 space-y-1.5">
            <h3 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Infrastruktur</h3>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(INFRA_ICONS).map(([typ, icon]) => (
                <button key={typ} onClick={() => setAddingInfra(addingInfra === typ ? null : typ)}
                  className={`px-2 py-1 rounded border transition ${addingInfra === typ ? "bg-amber-900/40 border-amber-700 text-amber-300" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}>
                  {icon} {typ.charAt(0) + typ.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* ── Detail-Panel: Game ── */}
          {selGame && (
            <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">{selGame.game.name}</p>
              <div className="space-y-1.5">
                <label className="text-zinc-500">Nummer im Plan:</label>
                <input type="text" value={selGame.nummer} maxLength={3}
                  onChange={e => {
                    const v = e.target.value;
                    setPlan(prev => prev ? { ...prev, gamePositionen: prev.gamePositionen.map(p => p.id === selGame.id ? { ...p, nummer: v } : p) } : prev);
                  }}
                  onBlur={() => updateGamePos(selGame.id, { nummer: selGame.nummer } as any)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Sichtbarkeit:</span>
                <button onClick={() => updateGamePos(selGame.id, { oeffentlich: !selGame.oeffentlich } as any)}
                  className={`px-2 py-0.5 rounded border transition ${selGame.oeffentlich ? "border-emerald-700 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}>
                  {selGame.oeffentlich ? "Öffentlich" : "OKW"}
                </button>
              </div>
              <p className="text-zinc-600">{selGame.game.flaecheLaengeM}×{selGame.game.flaecheBreiteM}m · {selGame.rotation}°</p>
              <div className="flex gap-2">
                <button onClick={() => rotate("game", selGame.gameId, selGame.rotation)}
                  className="flex-1 py-1 border border-zinc-700 rounded hover:bg-zinc-800 transition">↻ +45°</button>
                <button onClick={() => deleteItem("game", selGame.id)}
                  className="flex-1 py-1 border border-red-900 text-red-400 rounded hover:bg-red-950 transition">Entfernen</button>
              </div>
            </div>
          )}

          {/* ── Detail-Panel: Custom ── */}
          {selCustom && (
            <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
              <div className="space-y-1">
                <label className="text-zinc-500">Label:</label>
                <input type="text" value={selCustom.label}
                  onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, label: e.target.value } : f) } : prev)}
                  onBlur={() => updateCustom(selCustom.id, { label: selCustom.label })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-zinc-500">Nummer:</label>
                  <input type="text" value={selCustom.nummer} maxLength={3}
                    onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, nummer: e.target.value } : f) } : prev)}
                    onBlur={() => updateCustom(selCustom.id, { nummer: selCustom.nummer })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500">Farbe:</label>
                  <input type="color" value={selCustom.farbe}
                    onChange={e => {
                      const v = e.target.value;
                      setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, farbe: v } : f) } : prev);
                    }}
                    onBlur={() => updateCustom(selCustom.id, { farbe: selCustom.farbe })}
                    className="w-full h-7 bg-zinc-900 border border-zinc-700 rounded cursor-pointer" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-zinc-500">Länge (m):</label>
                  <input type="number" step="1" value={selCustom.laengeM}
                    onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, laengeM: parseFloat(e.target.value) || 10 } : f) } : prev)}
                    onBlur={() => updateCustom(selCustom.id, { laengeM: selCustom.laengeM })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500">Breite (m):</label>
                  <input type="number" step="1" value={selCustom.breiteM}
                    onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, breiteM: parseFloat(e.target.value) || 10 } : f) } : prev)}
                    onBlur={() => updateCustom(selCustom.id, { breiteM: selCustom.breiteM })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Sichtbarkeit:</span>
                <button onClick={() => updateCustom(selCustom.id, { oeffentlich: !selCustom.oeffentlich })}
                  className={`px-2 py-0.5 rounded border transition ${selCustom.oeffentlich ? "border-emerald-700 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}>
                  {selCustom.oeffentlich ? "Öffentlich" : "OKW"}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => rotate("custom", selCustom.id, selCustom.rotation)}
                  className="flex-1 py-1 border border-zinc-700 rounded hover:bg-zinc-800 transition">↻ +45°</button>
                <button onClick={() => deleteItem("custom", selCustom.id)}
                  className="flex-1 py-1 border border-red-900 text-red-400 rounded hover:bg-red-950 transition">Löschen</button>
              </div>
            </div>
          )}

          {/* ── Detail-Panel: Infra ── */}
          {selInfra && (
            <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
              <p>{INFRA_ICONS[selInfra.typ]} {selInfra.typ}{selInfra.label ? ` – ${selInfra.label}` : ""}</p>
              <button onClick={() => deleteItem("infra", selInfra.id)}
                className="w-full py-1 border border-red-900 text-red-400 rounded hover:bg-red-950 transition">Löschen</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
