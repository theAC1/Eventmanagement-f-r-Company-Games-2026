"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { GridStack, type GridStackNode } from "gridstack";
import "gridstack/dist/gridstack.min.css";

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
  hintergrundbildUrl: string | null;
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

// ─── Touch-Drag Fix ───
// GridStack (dd-touch.js) ruft bei pointerdown bedingungslos
// e.target.releasePointerCapture(e.pointerId) auf. Ohne aktive Capture wirft
// das einen DOMException ("No active pointer with the given id is found"),
// der im Dev-Overlay als Fehler aufblitzt. Wir machen den Aufruf idempotent:
// nur freigeben, wenn die Capture tatsächlich gehalten wird.
let pointerCapturePatched = false;
function patchReleasePointerCapture() {
  if (pointerCapturePatched || typeof Element === "undefined") return;
  pointerCapturePatched = true;
  const original = Element.prototype.releasePointerCapture;
  Element.prototype.releasePointerCapture = function (pointerId: number) {
    try {
      if (!this.hasPointerCapture || this.hasPointerCapture(pointerId)) {
        original.call(this, pointerId);
      }
    } catch {
      // Kein aktiver Pointer mit dieser id → ignorieren (Release ist ohnehin no-op)
    }
  };
}

const DEFAULT_MPP = 2.8;
const IMG_RATIO = 2078 / 1342;

// ─── GridStack Auflösung ───
// 100 Spalten → 1 % Raster in X, ~IMG_RATIO % Raster in Y (feine, dezente Snap-Schritte).
const COLS = 100;
const CELL_W_PCT = 100 / COLS;          // Zellbreite in % der Container-Breite
const CELL_H_PCT = CELL_W_PCT * IMG_RATIO; // quadratische Zellen → Zellhöhe in % der Container-Höhe

type Rect = { xPct: number; yPct: number; wPct: number; hPct: number };

// Länge/Breite (m) + Rotation → Feld-Grösse in Prozent (footprint, inkl. 90°-Swap)
function sizePct(laengeM: number, breiteM: number, rot: number, mpp: number) {
  const r90 = rot === 90 || rot === 270;
  const w = r90 ? breiteM : laengeM;
  const h = r90 ? laengeM : breiteM;
  return { wPct: w / mpp, hPct: (h / mpp) * IMG_RATIO };
}

// Zentrums-Prozent + Grösse → GridStack Rasterkoordinaten
function toGrid(xPct: number, yPct: number, wPct: number, hPct: number) {
  const w = Math.max(1, Math.round(wPct / CELL_W_PCT));
  const h = Math.max(1, Math.round(hPct / CELL_H_PCT));
  const x = Math.max(0, Math.round((xPct - wPct / 2) / CELL_W_PCT));
  const y = Math.max(0, Math.round((yPct - hPct / 2) / CELL_H_PCT));
  return { x, y, w, h };
}

// GridStack Node → Zentrums-Prozent + Grösse in Prozent
function fromGrid(node: { x?: number; y?: number; w?: number; h?: number }): Rect {
  const w = node.w ?? 1, h = node.h ?? 1, x = node.x ?? 0, y = node.y ?? 0;
  const wPct = w * CELL_W_PCT;
  const hPct = h * CELL_H_PCT;
  return { xPct: x * CELL_W_PCT + wPct / 2, yPct: y * CELL_H_PCT + hPct / 2, wPct, hPct };
}

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

// ─── GridStack Canvas-Layer ───
type MapGridProps = {
  games: GamePosition[];
  customs: CustomFeld[];
  mpp: number;
  selected: { type: "game" | "custom" | "infra"; id: string } | null;
  onSelect: (type: "game" | "custom", id: string) => void;
  onSave: (key: string, rect: Rect, mode: "drag" | "resize") => void;
};

function MapGrid({ games, customs, mpp, selected, onSelect, onSave }: MapGridProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Initiales Layout einmalig beim Mount aus den Daten berechnen.
  // GridStack besitzt danach die DOM-Position; React fasst gs-* nicht mehr an.
  const initialLayout = useRef<Record<string, { x: number; y: number; w: number; h: number }> | null>(null);
  if (initialLayout.current === null) {
    const m: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const pos of games) {
      const { wPct, hPct } = sizePct(pos.game.flaecheLaengeM ?? 10, pos.game.flaecheBreiteM ?? 10, pos.rotation, mpp);
      m["g:" + pos.gameId] = toGrid(pos.x, pos.y, wPct, hPct);
    }
    for (const cf of customs) {
      const { wPct, hPct } = sizePct(cf.laengeM, cf.breiteM, cf.rotation, mpp);
      m["c:" + cf.id] = toGrid(cf.x, cf.y, wPct, hPct);
    }
    initialLayout.current = m;
  }

  useEffect(() => {
    if (!elRef.current) return;
    patchReleasePointerCapture();
    const grid = GridStack.init(
      {
        column: COLS,
        cellHeight: "auto",
        float: true,
        margin: 0,
        animate: false,
        disableOneColumnMode: true,
        resizable: { handles: "n,ne,e,se,s,sw,w,nw" },
      } as any,
      elRef.current,
    )!;
    gridRef.current = grid;

    const route = (mode: "drag" | "resize") => (_e: Event, el: any) => {
      const node: GridStackNode | undefined = el?.gridstackNode;
      const key = el?.getAttribute?.("gs-id");
      if (!node || !key) return;
      onSaveRef.current(key, fromGrid(node), mode);
    };
    grid.on("dragstop", route("drag"));
    grid.on("resizestop", route("resize"));

    return () => {
      try { grid.destroy(false); } catch { /* noop */ }
      gridRef.current = null;
    };
  }, []);

  const renderItem = (
    key: string,
    id: string,
    type: "game" | "custom",
    label: string,
    bg: string,
    border: string,
    rotation: number,
    oeffentlich: boolean,
  ) => {
    const g = initialLayout.current![key];
    const isSel = selected?.type === type && selected.id === id;
    const r45 = rotation % 90 !== 0;
    return (
      <div
        key={key}
        className="grid-stack-item"
        gs-id={key}
        gs-x={g.x}
        gs-y={g.y}
        gs-w={g.w}
        gs-h={g.h}
      >
        <div
          className={`grid-stack-item-content flex items-center justify-center text-xs font-bold text-white/90 rounded-sm backdrop-blur-[2px] ${isSel ? "ring-2 ring-white/70" : "hover:ring-1 hover:ring-white/40"}`}
          onClick={(e) => { e.stopPropagation(); onSelect(type, id); }}
          style={{
            backgroundColor: bg,
            border: `1.5px solid ${border}`,
            opacity: oeffentlich ? 1 : 0.5,
            transform: r45 ? `rotate(${rotation}deg)` : undefined,
          }}
        >
          {label}
        </div>
      </div>
    );
  };

  return (
    <div className="grid-stack absolute inset-0 !bg-transparent" ref={elRef}>
      {games.map((pos) =>
        renderItem(
          "g:" + pos.gameId, pos.gameId, "game",
          pos.nummer || pos.game.name.charAt(0),
          MODUS_BG[pos.game.modus] ?? MODUS_BG.SOLO,
          MODUS_BORDER[pos.game.modus] ?? MODUS_BORDER.SOLO,
          pos.rotation, pos.oeffentlich,
        ),
      )}
      {customs.map((cf) =>
        renderItem(
          "c:" + cf.id, cf.id, "custom",
          cf.nummer || cf.label.charAt(0),
          cf.farbe + "cc", cf.farbe, cf.rotation, cf.oeffentlich,
        ),
      )}
    </div>
  );
}

type CreateForm = { label: string; nummer: string; farbe: string; laengeM: number; breiteM: number };

export default function SituationsplanPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allGames, setAllGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ type: "game" | "custom" | "infra"; id: string } | null>(null);
  const [addingInfra, setAddingInfra] = useState<string | null>(null);
  const [mpp, setMpp] = useState(DEFAULT_MPP);
  const [remountTick, setRemountTick] = useState(0);
  const [creating, setCreating] = useState<CreateForm | null>(null);
  const [bildUrl, setBildUrl] = useState("");
  const [bildSaving, setBildSaving] = useState(false);
  const [bildUploading, setBildUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const p = await fetch("/api/situationsplan").then(r => r.json());
    setPlan(p);
    setBildUrl(p?.hintergrundbildUrl ?? "");
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/situationsplan").then(r => r.json()),
      fetch("/api/games").then(r => r.json()),
    ]).then(([p, g]) => { setPlan(p); setBildUrl(p?.hintergrundbildUrl ?? ""); setAllGames(g); setLoading(false); });
  }, []);

  const placedIds = new Set(plan?.gamePositionen.map(p => p.gameId) ?? []);
  const unplaced = allGames.filter(g => !placedIds.has(g.id));

  const fieldSize = (lM: number, bM: number, rot: number) => sizePct(lM, bM, rot, mpp);

  // ─── Save nach Drag/Resize (GridStack) ───
  const handleSave = useCallback(async (key: string, rect: Rect, mode: "drag" | "resize") => {
    const type = key.slice(0, 1);
    const id = key.slice(2);
    const xPct = clampPct(rect.xPct);
    const yPct = clampPct(rect.yPct);

    if (type === "g") {
      const pos = plan?.gamePositionen.find(p => p.gameId === id);
      if (!pos) return;
      await fetch(`/api/situationsplan/position/${pos.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: xPct, y: yPct, rotation: pos.rotation }),
      });
      let sizePatch: { flaecheLaengeM: number; flaecheBreiteM: number } | null = null;
      if (mode === "resize") {
        const r90 = pos.rotation === 90 || pos.rotation === 270;
        const laengeM = Math.max(1, Math.round((r90 ? rect.hPct / IMG_RATIO : rect.wPct) * mpp));
        const breiteM = Math.max(1, Math.round((r90 ? rect.wPct : rect.hPct / IMG_RATIO) * mpp));
        await fetch(`/api/games/${id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flaecheLaengeM: laengeM, flaecheBreiteM: breiteM }),
        });
        sizePatch = { flaecheLaengeM: laengeM, flaecheBreiteM: breiteM };
      }
      setPlan(prev => prev ? {
        ...prev,
        gamePositionen: prev.gamePositionen.map(p => p.gameId === id
          ? { ...p, x: xPct, y: yPct, game: sizePatch ? { ...p.game, ...sizePatch } : p.game }
          : p),
      } : prev);
    } else {
      const cf = plan?.customFelder.find(f => f.id === id);
      if (!cf) return;
      let laengeM = cf.laengeM, breiteM = cf.breiteM;
      if (mode === "resize") {
        const r90 = cf.rotation === 90 || cf.rotation === 270;
        laengeM = Math.max(1, Math.round((r90 ? rect.hPct / IMG_RATIO : rect.wPct) * mpp));
        breiteM = Math.max(1, Math.round((r90 ? rect.wPct : rect.hPct / IMG_RATIO) * mpp));
      }
      await fetch(`/api/situationsplan/custom/${cf.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cf, x: xPct, y: yPct, laengeM, breiteM }),
      });
      setPlan(prev => prev ? {
        ...prev,
        customFelder: prev.customFelder.map(f => f.id === id ? { ...f, x: xPct, y: yPct, laengeM, breiteM } : f),
      } : prev);
    }
  }, [plan, mpp]);

  // ─── Actions ───
  const placeGame = async (gameId: string) => {
    if (!plan) return;
    await fetch("/api/situationsplan", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, gameId, x: 50, y: 50 }),
    });
    await reload();
  };

  const submitCreate = async () => {
    if (!plan || !creating) return;
    await fetch("/api/situationsplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom", planId: plan.id,
        label: creating.label.trim() || "Neues Feld",
        nummer: creating.nummer.trim(),
        farbe: creating.farbe,
        laengeM: creating.laengeM || 10,
        breiteM: creating.breiteM || 10,
        x: 50, y: 50,
      }),
    });
    setCreating(null);
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

  const updateCustom = async (cfId: string, data: Partial<CustomFeld>, remount = false) => {
    const cf = plan?.customFelder.find(f => f.id === cfId);
    if (!cf) return;
    await fetch(`/api/situationsplan/custom/${cfId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cf, ...data }),
    });
    await reload();
    if (remount) setRemountTick(t => t + 1);
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

  // ─── Lageplan-Hintergrundbild (Team-Portal) ───
  const saveBildUrl = async (value: string | null) => {
    if (!plan) return;
    setBildSaving(true);
    try {
      const res = await fetch(`/api/situationsplan/${plan.id}/hintergrund`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hintergrundbildUrl: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Speichern fehlgeschlagen");
        return;
      }
      await reload();
    } finally {
      setBildSaving(false);
    }
  };

  const uploadBild = async (file: File) => {
    if (!plan) return;
    if (!file.type.startsWith("image/")) {
      alert("Bitte eine Bilddatei auswählen.");
      return;
    }
    setBildUploading(true);
    try {
      // Direkt-Upload auf unseren Server (Docker-Volume, siehe /api/uploads)
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Datei-Upload fehlgeschlagen");
        return;
      }
      const { url } = await res.json();

      // Ergebnis-URL als Lageplan-Bild speichern
      setBildUrl(url);
      await saveBildUrl(url);
    } finally {
      setBildUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Export ───
  const exportImage = async () => {
    if (!ref.current) return;
    try {
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

  // GridStack remountet nur bei Struktur-/Rotations-/Skalierungs-Änderungen,
  // nicht bei reinen Drag/Resize-Positionierungen (die besitzt GridStack selbst).
  const gridKey = useMemo(() => {
    if (!plan) return "empty";
    const parts = [
      ...plan.gamePositionen.map(p => `g${p.gameId}:${p.rotation}`),
      ...plan.customFelder.map(c => `c${c.id}:${c.rotation}`),
    ].sort();
    return parts.join(",") + `|${mpp}|${remountTick}`;
  }, [plan, mpp, remountTick]);

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Lade...</div>;

  const selGame = selected?.type === "game" ? plan?.gamePositionen.find(p => p.gameId === selected.id) : null;
  const selCustom = selected?.type === "custom" ? plan?.customFelder.find(f => f.id === selected.id) : null;
  const selInfra = selected?.type === "infra" ? plan?.infrastruktur.find(e => e.id === selected.id) : null;

  return (
    <div className="space-y-4">
      {/* GridStack Resize-Handles im Dark-UI-Stil */}
      <style>{`
        .grid-stack { background: transparent; }
        .grid-stack-item-content { inset: 0; overflow: visible; cursor: grab; }
        .grid-stack-item.ui-draggable-dragging .grid-stack-item-content { cursor: grabbing; }
        .grid-stack > .grid-stack-item > .ui-resizable-handle {
          background: none; opacity: 0; transition: opacity .12s;
        }
        .grid-stack > .grid-stack-item:hover > .ui-resizable-handle,
        .grid-stack > .grid-stack-item.ui-resizable-resizing > .ui-resizable-handle { opacity: 1; }
        .grid-stack > .grid-stack-item > .ui-resizable-handle::before {
          content: ""; position: absolute; width: 8px; height: 8px; border-radius: 9999px;
          background: #fff; border: 1px solid rgba(0,0,0,0.5); box-shadow: 0 0 2px rgba(0,0,0,0.6);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
        }
        .grid-stack > .grid-stack-item > .ui-resizable-nw { top: -4px; left: -4px; cursor: nwse-resize; }
        .grid-stack > .grid-stack-item > .ui-resizable-ne { top: -4px; right: -4px; cursor: nesw-resize; }
        .grid-stack > .grid-stack-item > .ui-resizable-sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
        .grid-stack > .grid-stack-item > .ui-resizable-se { bottom: -4px; right: -4px; cursor: nwse-resize; }
        /* Touch (Tablet): kein Hover → Griffe immer sichtbar + grössere Tap-Fläche */
        @media (pointer: coarse) {
          .grid-stack > .grid-stack-item > .ui-resizable-handle { opacity: 1; width: 28px; height: 28px; }
          .grid-stack > .grid-stack-item > .ui-resizable-handle::before { width: 12px; height: 12px; }
          .grid-stack > .grid-stack-item > .ui-resizable-nw { top: -14px; left: -14px; }
          .grid-stack > .grid-stack-item > .ui-resizable-ne { top: -14px; right: -14px; }
          .grid-stack > .grid-stack-item > .ui-resizable-sw { bottom: -14px; left: -14px; }
          .grid-stack > .grid-stack-item > .ui-resizable-se { bottom: -14px; right: -14px; }
        }
      `}</style>

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

      {/* Lageplan-Bild fürs Team-Portal */}
      <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Lageplan-Bild (Team-Portal)</h3>
          {plan?.hintergrundbildUrl
            ? <span className="text-[10px] text-emerald-400">Aktiv – Teams sehen dieses Bild</span>
            : <span className="text-[10px] text-zinc-500">Kein Bild gesetzt – Teams sehen Platzhalter</span>}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadBild(f); }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={bildUploading || bildSaving}
            className="px-3 py-1 border border-emerald-700 text-emerald-300 rounded hover:bg-emerald-950 transition disabled:opacity-50">
            {bildUploading ? "Lädt hoch…" : "Bild hochladen"}
          </button>
          <span className="text-[10px] text-zinc-600">oder URL einfügen:</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="url" value={bildUrl} placeholder="https://… Bild-URL des Lageplans einfügen"
            onChange={e => setBildUrl(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs" />
          <button onClick={() => saveBildUrl(bildUrl)} disabled={bildSaving}
            className="px-3 py-1 border border-emerald-700 text-emerald-300 rounded hover:bg-emerald-950 transition disabled:opacity-50">
            {bildSaving ? "Speichert…" : "Speichern"}
          </button>
          {plan?.hintergrundbildUrl && (
            <button onClick={() => { setBildUrl(""); saveBildUrl(null); }} disabled={bildSaving}
              className="px-3 py-1 border border-red-900 text-red-400 rounded hover:bg-red-950 transition disabled:opacity-50">
              Entfernen
            </button>
          )}
        </div>
        {plan?.hintergrundbildUrl && (
          <img src={plan.hintergrundbildUrl} alt="Lageplan-Vorschau"
            className="max-h-32 rounded border border-zinc-800 object-contain" />
        )}
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-4">
        {/* ── Canvas ── */}
        <div ref={ref}
          className={`relative border border-zinc-800 rounded-lg overflow-hidden select-none ${addingInfra ? "cursor-crosshair" : ""}`}
          onClick={e => { if (addingInfra) { addInfra(e); return; } setSelected(null); }}
          style={{ aspectRatio: `${IMG_RATIO}` }}>

          <img src="/images/situationsplan.jpg" alt="" className="absolute inset-0 w-full h-full object-cover z-0" draggable={false} />

          {/* GridStack Canvas: Game-Felder & Custom-Felder */}
          <MapGrid
            key={gridKey}
            games={plan?.gamePositionen ?? []}
            customs={plan?.customFelder ?? []}
            mpp={mpp}
            selected={selected}
            onSelect={(type, id) => setSelected({ type, id })}
            onSave={handleSave}
          />

          {/* Infrastruktur */}
          {plan?.infrastruktur.map(el => (
            <div key={el.id}
              onClick={e => { e.stopPropagation(); setSelected({ type: "infra", id: el.id }); }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 text-lg cursor-pointer ${selected?.type === "infra" && selected.id === el.id ? "ring-2 ring-white/60 rounded-full" : ""}`}
              style={{ left: `${el.x}%`, top: `${el.y}%`, opacity: el.oeffentlich ? 1 : 0.4 }}
              title={el.label ?? el.typ}>
              {INFRA_ICONS[el.typ] ?? "📍"}
            </div>
          ))}

          {addingInfra && (
            <div className="absolute top-2 left-2 bg-zinc-900/90 text-xs text-amber-300 px-2 py-1 rounded z-40">
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
          <button onClick={() => setCreating({ label: "", nummer: "", farbe: "#6b7280", laengeM: 10, breiteM: 10 })}
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{selGame.game.name}</p>
                <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">↔ Ecken ziehen</span>
              </div>
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
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Custom-Feld</span>
                <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">↔ Ecken ziehen</span>
              </div>
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
                    onBlur={() => updateCustom(selCustom.id, { laengeM: selCustom.laengeM }, true)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500">Breite (m):</label>
                  <input type="number" step="1" value={selCustom.breiteM}
                    onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, breiteM: parseFloat(e.target.value) || 10 } : f) } : prev)}
                    onBlur={() => updateCustom(selCustom.id, { breiteM: selCustom.breiteM }, true)}
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

      {/* ── Custom-Feld Erstell-Modal ── */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setCreating(null)}>
          <div className="w-80 bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 text-xs"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Custom-Feld anlegen</h3>
            <div className="space-y-1">
              <label className="text-zinc-500">Label:</label>
              <input autoFocus type="text" value={creating.label}
                onChange={e => setCreating(c => c ? { ...c, label: e.target.value } : c)}
                placeholder="z.B. Verpflegung"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-zinc-500">Nummer:</label>
                <input type="text" maxLength={3} value={creating.nummer}
                  onChange={e => setCreating(c => c ? { ...c, nummer: e.target.value } : c)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-center font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500">Farbe:</label>
                <input type="color" value={creating.farbe}
                  onChange={e => setCreating(c => c ? { ...c, farbe: e.target.value } : c)}
                  className="w-full h-8 bg-zinc-900 border border-zinc-700 rounded cursor-pointer" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-zinc-500">Länge (m):</label>
                <input type="number" step="1" min="1" value={creating.laengeM}
                  onChange={e => setCreating(c => c ? { ...c, laengeM: parseFloat(e.target.value) || 10 } : c)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5" />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500">Breite (m):</label>
                <input type="number" step="1" min="1" value={creating.breiteM}
                  onChange={e => setCreating(c => c ? { ...c, breiteM: parseFloat(e.target.value) || 10 } : c)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCreating(null)}
                className="flex-1 py-1.5 border border-zinc-700 rounded hover:bg-zinc-800 transition">Abbrechen</button>
              <button onClick={submitCreate}
                className="flex-1 py-1.5 border border-emerald-700 text-emerald-300 rounded hover:bg-emerald-950 transition">Anlegen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
