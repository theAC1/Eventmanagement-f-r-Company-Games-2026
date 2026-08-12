"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { GridStack, type GridItemHTMLElement, type GridStackNode } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import {
  ArrowClockwise,
  Car,
  DownloadSimple,
  Drop,
  Eye,
  FirstAidKit,
  Lightning,
  Lock,
  MapPin,
  PersonSimpleWalk,
  Users,
  type Icon,
} from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";

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

const INFRA_META: Record<string, { icon: Icon; cls: string; label: string }> = {
  STROM: { icon: Lightning, cls: "text-warn", label: "Strom" },
  WASSER: { icon: Drop, cls: "text-action-tint", label: "Wasser" },
  WEG: { icon: PersonSimpleWalk, cls: "text-ink-2", label: "Weg" },
  PARKPLATZ: { icon: Car, cls: "text-ink-3", label: "Parkplatz" },
  ZUSCHAUER: { icon: Users, cls: "text-ink-2", label: "Zuschauer" },
  SANITAER: { icon: FirstAidKit, cls: "text-hot-tint", label: "Sanitär" },
  SONSTIGES: { icon: MapPin, cls: "text-ink-3", label: "Sonstiges" },
};
const infraMeta = (typ: string) => INFRA_META[typ] ?? INFRA_META.SONSTIGES;

const MODUS_BG: Record<string, string> = {
  SOLO: "var(--solo)", DUELL: "var(--duell)",
};
const MODUS_BORDER: Record<string, string> = {
  SOLO: "var(--solo-border)", DUELL: "var(--duell-border)",
};
const MODUS_TW: Record<string, string> = {
  SOLO: "bg-done-dim text-done-tint hover:bg-done-dim-strong",
  DUELL: "bg-action-dim text-action-tint hover:bg-action-dim-strong",
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

/** Rasterkoordinaten aller Felder, einmalig aus den Daten berechnet. */
type Layout = Record<string, { x: number; y: number; w: number; h: number }>;

function berechneLayout(games: GamePosition[], customs: CustomFeld[], mpp: number): Layout {
  const layout: Layout = {};
  for (const pos of games) {
    const { wPct, hPct } = sizePct(pos.game.flaecheLaengeM ?? 10, pos.game.flaecheBreiteM ?? 10, pos.rotation, mpp);
    layout["g:" + pos.gameId] = toGrid(pos.x, pos.y, wPct, hPct);
  }
  for (const cf of customs) {
    const { wPct, hPct } = sizePct(cf.laengeM, cf.breiteM, cf.rotation, mpp);
    layout["c:" + cf.id] = toGrid(cf.x, cf.y, wPct, hPct);
  }
  return layout;
}

function MapGrid({ games, customs, mpp, selected, onSelect, onSave }: MapGridProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);
  const onSaveRef = useRef(onSave);

  // Der Effekt unten läuft nur beim Mount, braucht aber immer den neuesten
  // Callback — deshalb über eine Ref, die nach jedem Render nachgezogen wird.
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Initiales Layout einmalig beim Mount aus den Daten berechnen. GridStack
  // besitzt danach die DOM-Position; React fasst gs-* nicht mehr an. Bewusst
  // State mit Lazy-Initialisierung statt einer Ref: der Wert wird beim Rendern
  // gelesen, und genau das darf eine Ref nicht.
  const [initialLayout] = useState<Layout>(() => berechneLayout(games, customs, mpp));

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
        resizable: { handles: "n,ne,e,se,s,sw,w,nw" },
      },
      elRef.current,
    )!;
    gridRef.current = grid;

    const route =
      (mode: "drag" | "resize") => (_e: Event, el: GridItemHTMLElement) => {
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
    const g = initialLayout[key];
    if (!g) return null;
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
          className={`grid-stack-item-content tnum flex items-center justify-center rounded-[4px] text-[13px] font-bold backdrop-blur-[2px] ${isSel ? "" : "hover:ring-1 hover:ring-white/40"}`}
          onClick={(e) => { e.stopPropagation(); onSelect(type, id); }}
          style={{
            backgroundColor: bg,
            border: isSel ? "2px solid #F2F8FF" : `1.5px solid ${border}`,
            boxShadow: isSel ? "0 0 0 4px var(--action-ring)" : undefined,
            color: "#F2F8FF",
            opacity: oeffentlich ? 1 : 0.5,
            transform: r45 ? `rotate(${rotation}deg)` : undefined,
          }}
        >
          {label}
          {!oeffentlich && (
            <span className="pointer-events-none absolute inset-x-0 bottom-[2px] text-center text-[8px] font-semibold tracking-[0.1em] opacity-80">
              OKW
            </span>
          )}
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

// Wiederkehrende Input-Optik (Redesign): sunken Füllung, starke Linie
const INPUT_CLS =
  "w-full rounded-lg border border-line-strong bg-sunken px-2 py-1.5 text-xs text-ink placeholder:text-faint";

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

  if (loading) {
    return (
      <>
        <TopBar title="Lageplan" />
        <div className="flex h-64 items-center justify-center text-sm text-ink-3">Lade…</div>
      </>
    );
  }

  const selGame = selected?.type === "game" ? plan?.gamePositionen.find(p => p.gameId === selected.id) : null;
  const selCustom = selected?.type === "custom" ? plan?.customFelder.find(f => f.id === selected.id) : null;
  const selInfra = selected?.type === "infra" ? plan?.infrastruktur.find(e => e.id === selected.id) : null;

  const placedCount = plan?.gamePositionen.length ?? 0;

  return (
    <div className="flex flex-col">
      {/* GridStack Resize-Handles im Redesign-Stil */}
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
          background: #F2F8FF; border: 1px solid rgba(0,0,0,0.5); box-shadow: 0 0 2px rgba(0,0,0,0.6);
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

      <TopBar title="Lageplan">
        <span className="hidden text-xs text-ink-3 sm:inline">
          <span className="tnum">{placedCount}</span> von{" "}
          <span className="tnum">{allGames.length}</span> Games platziert
        </span>
        <TopBarSpacer />
        <Button variant="ghost" onClick={exportImage}>
          <DownloadSimple size={15} weight="bold" /> PNG
        </Button>
      </TopBar>

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-[22px]">
        {/* Lageplan-Bild fürs Team-Portal */}
        <div className="space-y-2.5 rounded-[10px] border border-line bg-surface p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="cg-label">Lageplan-Bild (Team-Portal)</h3>
            {plan?.hintergrundbildUrl
              ? <span className="text-[11px] font-medium text-done-tint">Aktiv – Teams sehen dieses Bild</span>
              : <span className="text-[11px] text-ink-3">Kein Bild gesetzt – Teams sehen Platzhalter</span>}
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadBild(f); }} />
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={bildUploading || bildSaving}>
              {bildUploading ? "Lädt hoch…" : "Bild hochladen"}
            </Button>
            <span className="text-[11px] text-ink-3">oder URL einfügen:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="url" value={bildUrl} placeholder="https://… Bild-URL des Lageplans einfügen"
              onChange={e => setBildUrl(e.target.value)}
              className={`min-w-0 flex-1 ${INPUT_CLS}`} />
            <Button variant="ghost" onClick={() => saveBildUrl(bildUrl)} disabled={bildSaving}>
              {bildSaving ? "Speichert…" : "Speichern"}
            </Button>
            {plan?.hintergrundbildUrl && (
              <Button variant="danger-ghost" onClick={() => { setBildUrl(""); saveBildUrl(null); }} disabled={bildSaving}>
                Entfernen
              </Button>
            )}
          </div>
          {plan?.hintergrundbildUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Vorschau einer hochgeladenen Datei, keine Optimierung nötig
            <img src={plan.hintergrundbildUrl} alt="Lageplan-Vorschau"
              className="max-h-32 rounded-lg border border-line object-contain" />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
          {/* ── Canvas + Massstab-Leiste ── */}
          <div className="min-w-0">
            <div ref={ref}
              className={`relative overflow-hidden rounded-[10px] border border-line bg-[#08101B] select-none ${addingInfra ? "cursor-crosshair" : ""}`}
              onClick={e => { if (addingInfra) { addInfra(e); return; } setSelected(null); }}
              style={{ aspectRatio: `${IMG_RATIO}` }}>

              {/* eslint-disable-next-line @next/next/no-img-element -- Hintergrundbild des Plans, wird als Canvas-Untergrund gebraucht */}
              <img src="/images/situationsplan.jpg" alt=""
                className="absolute inset-0 z-0 h-full w-full object-cover opacity-[0.62] [html[data-theme=light]_&]:opacity-80"
                draggable={false} />

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
              {plan?.infrastruktur.map(el => {
                const meta = infraMeta(el.typ);
                const MetaIcon = meta.icon;
                const isSelInfra = selected?.type === "infra" && selected.id === el.id;
                return (
                  <div key={el.id}
                    onClick={e => { e.stopPropagation(); setSelected({ type: "infra", id: el.id }); }}
                    className={`absolute z-30 flex h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-sunken ${isSelInfra ? "border-action ring-4 ring-[var(--action-ring)]" : "border-line-key"}`}
                    style={{ left: `${el.x}%`, top: `${el.y}%`, opacity: el.oeffentlich ? 1 : 0.4 }}
                    title={el.label ?? meta.label}>
                    <MetaIcon size={14} weight="bold" className={meta.cls} />
                  </div>
                );
              })}

              {/* Overlay-Chips: Raster-Info + Massstab */}
              <div className="pointer-events-none absolute right-2 top-2 z-20 rounded-[9px] border border-line px-3 py-2"
                style={{ background: "var(--map-overlay)" }}>
                <span className="tnum text-[11px] text-label">1 % Raster · Snap an</span>
              </div>
              <div className="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-2 rounded-[9px] border border-line px-3 py-2"
                style={{ background: "var(--map-overlay)" }}>
                <span className="h-[3px] w-14 rounded-full bg-ink" aria-hidden />
                <span className="tnum text-[11px] text-label">{mpp} m pro %</span>
              </div>

              {addingInfra && (
                <div className="absolute left-2 top-2 z-40 rounded-[9px] border border-line px-3 py-2 text-[11px] text-warn"
                  style={{ background: "var(--map-overlay)" }}>
                  Klicke um {addingInfra.toLowerCase()} zu platzieren &middot;{" "}
                  <button onClick={e => { e.stopPropagation(); setAddingInfra(null); }} className="underline">Abbrechen</button>
                </div>
              )}
            </div>

            {/* Untere Leiste: Massstab + Legende */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5">
              <span className="cg-label">Massstab</span>
              <input type="number" step="0.1" min="0.5" max="5" value={mpp}
                onChange={e => setMpp(parseFloat(e.target.value) || DEFAULT_MPP)}
                className="tnum w-16 rounded-lg border border-line-strong bg-sunken px-1.5 py-1 text-center text-xs text-ink" />
              <span className="tnum text-[11px] text-ink-3">m pro %</span>
              <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
              <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className="h-3 w-3 rounded-[3px]"
                  style={{ background: "var(--solo)", border: "1px solid var(--solo-border)" }} aria-hidden />
                Solo
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className="h-3 w-3 rounded-[3px]"
                  style={{ background: "var(--duell)", border: "1px solid var(--duell-border)" }} aria-hidden />
                Duell
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <Lock size={12} weight="bold" className="text-label" />
                OKW · für Gäste verborgen
              </span>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-3 overflow-y-auto text-xs lg:max-h-[calc(100vh-160px)]">

            {/* Legende: Platzierte Games */}
            {plan && plan.gamePositionen.length > 0 && (
              <div className="space-y-1 rounded-[10px] border border-line bg-surface p-3">
                <h3 className="cg-label pb-1">Legende – Games</h3>
                {plan.gamePositionen.map(pos => (
                  <div key={pos.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors duration-150 ${selected?.type === "game" && selected.id === pos.gameId ? "bg-action-row" : "hover:bg-sunken/60"}`}
                    onClick={() => setSelected({ type: "game", id: pos.gameId })}>
                    <div className="tnum flex h-5 w-5 items-center justify-center rounded-[5px] text-[9px] font-bold text-[#F2F8FF]"
                      style={{ backgroundColor: MODUS_BG[pos.game.modus], border: `1px solid ${MODUS_BORDER[pos.game.modus]}` }}>
                      {pos.nummer || "–"}
                    </div>
                    <span className="flex-1 truncate text-ink-2">{pos.game.name}</span>
                    {pos.oeffentlich
                      ? <Eye size={12} weight="bold" className="text-label" />
                      : <Lock size={12} weight="bold" className="text-label" aria-label="OKW" />}
                  </div>
                ))}
              </div>
            )}

            {/* Legende: Custom-Felder */}
            {plan && plan.customFelder.length > 0 && (
              <div className="space-y-1 rounded-[10px] border border-line bg-surface p-3">
                <h3 className="cg-label pb-1">Legende – Custom</h3>
                {plan.customFelder.map(cf => (
                  <div key={cf.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors duration-150 ${selected?.type === "custom" && selected.id === cf.id ? "bg-action-row" : "hover:bg-sunken/60"}`}
                    onClick={() => setSelected({ type: "custom", id: cf.id })}>
                    <div className="tnum flex h-5 w-5 items-center justify-center rounded-[5px] text-[9px] font-bold text-[#F2F8FF]"
                      style={{ backgroundColor: cf.farbe }}>
                      {cf.nummer || "–"}
                    </div>
                    <span className="flex-1 truncate text-ink-2">{cf.label}</span>
                    {cf.oeffentlich
                      ? <Eye size={12} weight="bold" className="text-label" />
                      : <Lock size={12} weight="bold" className="text-label" aria-label="OKW" />}
                  </div>
                ))}
              </div>
            )}

            {/* Unplatzierte Games */}
            <div className="space-y-1.5 rounded-[10px] border border-line bg-surface p-3">
              <h3 className="cg-label pb-0.5">Nicht platziert ({unplaced.length})</h3>
              {unplaced.length === 0 ? <p className="text-ink-3">Alle platziert</p> : (
                <div className="space-y-1">
                  {unplaced.map(g => (
                    <button key={g.id} onClick={() => placeGame(g.id)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-left font-medium transition-colors duration-150 ${MODUS_TW[g.modus] ?? MODUS_TW.SOLO}`}>
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom-Feld hinzufügen */}
            <button onClick={() => setCreating({ label: "", nummer: "", farbe: "#6b7280", laengeM: 10, breiteM: 10 })}
              className="w-full rounded-[10px] border border-dashed border-line-strong px-3 py-2 font-medium text-ink-3 transition-colors duration-150 hover:border-action hover:text-action-tint">
              + Custom-Feld
            </button>

            {/* Infrastruktur */}
            <div className="space-y-1.5 rounded-[10px] border border-line bg-surface p-3">
              <h3 className="cg-label pb-0.5">Infrastruktur</h3>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(INFRA_META).map(([typ, meta]) => {
                  const MetaIcon = meta.icon;
                  return (
                    <button key={typ} onClick={() => setAddingInfra(addingInfra === typ ? null : typ)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors duration-150 ${addingInfra === typ ? "border-action bg-action-dim font-semibold text-action-tint" : "border-line-strong bg-sunken text-ink-3 hover:text-ink-2"}`}>
                      <MetaIcon size={13} weight="bold" className={addingInfra === typ ? undefined : meta.cls} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Detail-Panel: Game ── */}
            {selGame && (
              <div className="space-y-3 rounded-[10px] border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{selGame.game.name}</p>
                  <span className="cg-label whitespace-nowrap rounded-md border border-line px-1.5 py-0.5">Ecken ziehen</span>
                </div>
                <div className="space-y-1.5">
                  <label className="cg-label block">Nummer im Plan</label>
                  <input type="text" value={selGame.nummer} maxLength={3}
                    onChange={e => {
                      const v = e.target.value;
                      setPlan(prev => prev ? { ...prev, gamePositionen: prev.gamePositionen.map(p => p.id === selGame.id ? { ...p, nummer: v } : p) } : prev);
                    }}
                    onBlur={() => updateGamePos(selGame.id, { nummer: selGame.nummer })}
                    className={`tnum text-center ${INPUT_CLS}`} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="cg-label">Sichtbarkeit</span>
                  <button onClick={() => updateGamePos(selGame.id, { oeffentlich: !selGame.oeffentlich })}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-colors duration-150 ${selGame.oeffentlich ? "border-done bg-done-dim text-done-tint" : "border-line-strong bg-sunken text-ink-3"}`}>
                    {selGame.oeffentlich ? <Eye size={13} weight="bold" /> : <Lock size={13} weight="bold" />}
                    {selGame.oeffentlich ? "Öffentlich" : "OKW"}
                  </button>
                </div>
                <p className="tnum text-[11px] text-ink-3">
                  {selGame.game.flaecheLaengeM}×{selGame.game.flaecheBreiteM} m · {selGame.rotation}°
                </p>
                <div className="flex gap-2">
                  <button onClick={() => rotate("game", selGame.gameId, selGame.rotation)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-sunken py-1.5 font-medium text-ink-2 transition-colors duration-150 hover:border-action hover:text-action-tint">
                    <ArrowClockwise size={13} weight="bold" /> +45°
                  </button>
                  <button onClick={() => deleteItem("game", selGame.id)}
                    className="flex-1 rounded-lg border border-[var(--hot-border)] py-1.5 font-medium text-hot-tint transition-colors duration-150 hover:bg-hot-dim">
                    Vom Plan entfernen
                  </button>
                </div>
              </div>
            )}

            {/* ── Detail-Panel: Custom ── */}
            {selCustom && (
              <div className="space-y-3 rounded-[10px] border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="cg-label">Custom-Feld</span>
                  <span className="cg-label whitespace-nowrap rounded-md border border-line px-1.5 py-0.5">Ecken ziehen</span>
                </div>
                <div className="space-y-1.5">
                  <label className="cg-label block">Label</label>
                  <input type="text" value={selCustom.label}
                    onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, label: e.target.value } : f) } : prev)}
                    onBlur={() => updateCustom(selCustom.id, { label: selCustom.label })}
                    className={INPUT_CLS} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="cg-label block">Nummer</label>
                    <input type="text" value={selCustom.nummer} maxLength={3}
                      onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, nummer: e.target.value } : f) } : prev)}
                      onBlur={() => updateCustom(selCustom.id, { nummer: selCustom.nummer })}
                      className={`tnum text-center ${INPUT_CLS}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="cg-label block">Farbe</label>
                    <input type="color" value={selCustom.farbe}
                      onChange={e => {
                        const v = e.target.value;
                        setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, farbe: v } : f) } : prev);
                      }}
                      onBlur={() => updateCustom(selCustom.id, { farbe: selCustom.farbe })}
                      className="h-8 w-full cursor-pointer rounded-lg border border-line-strong bg-sunken" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="cg-label block">Länge (m)</label>
                    <input type="number" step="1" value={selCustom.laengeM}
                      onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, laengeM: parseFloat(e.target.value) || 10 } : f) } : prev)}
                      onBlur={() => updateCustom(selCustom.id, { laengeM: selCustom.laengeM }, true)}
                      className={`tnum ${INPUT_CLS}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="cg-label block">Breite (m)</label>
                    <input type="number" step="1" value={selCustom.breiteM}
                      onChange={e => setPlan(prev => prev ? { ...prev, customFelder: prev.customFelder.map(f => f.id === selCustom.id ? { ...f, breiteM: parseFloat(e.target.value) || 10 } : f) } : prev)}
                      onBlur={() => updateCustom(selCustom.id, { breiteM: selCustom.breiteM }, true)}
                      className={`tnum ${INPUT_CLS}`} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="cg-label">Sichtbarkeit</span>
                  <button onClick={() => updateCustom(selCustom.id, { oeffentlich: !selCustom.oeffentlich })}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-colors duration-150 ${selCustom.oeffentlich ? "border-done bg-done-dim text-done-tint" : "border-line-strong bg-sunken text-ink-3"}`}>
                    {selCustom.oeffentlich ? <Eye size={13} weight="bold" /> : <Lock size={13} weight="bold" />}
                    {selCustom.oeffentlich ? "Öffentlich" : "OKW"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => rotate("custom", selCustom.id, selCustom.rotation)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-sunken py-1.5 font-medium text-ink-2 transition-colors duration-150 hover:border-action hover:text-action-tint">
                    <ArrowClockwise size={13} weight="bold" /> +45°
                  </button>
                  <button onClick={() => deleteItem("custom", selCustom.id)}
                    className="flex-1 rounded-lg border border-[var(--hot-border)] py-1.5 font-medium text-hot-tint transition-colors duration-150 hover:bg-hot-dim">
                    Löschen
                  </button>
                </div>
              </div>
            )}

            {/* ── Detail-Panel: Infra ── */}
            {selInfra && (
              <div className="space-y-3 rounded-[10px] border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const meta = infraMeta(selInfra.typ);
                    const MetaIcon = meta.icon;
                    return (
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line-key bg-sunken">
                        <MetaIcon size={14} weight="bold" className={meta.cls} />
                      </span>
                    );
                  })()}
                  <p className="text-ink-2">
                    {infraMeta(selInfra.typ).label}{selInfra.label ? ` – ${selInfra.label}` : ""}
                  </p>
                </div>
                <button onClick={() => deleteItem("infra", selInfra.id)}
                  className="w-full rounded-lg border border-[var(--hot-border)] py-1.5 font-medium text-hot-tint transition-colors duration-150 hover:bg-hot-dim">
                  Löschen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Custom-Feld Erstell-Modal ── */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "var(--scrim)" }}
          onClick={() => setCreating(null)}
          onKeyDown={e => {
            if (e.key === "Escape") setCreating(null);
          }}>
          <div role="dialog" aria-modal="true" aria-label="Custom-Feld anlegen"
            className="anim-pop w-80 space-y-3 rounded-[14px] border border-line bg-surface p-4 text-xs"
            style={{ boxShadow: "var(--shadow-pop)" }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-ink">Custom-Feld anlegen</h3>
            <div className="space-y-1.5">
              <label className="cg-label block">Label</label>
              <input autoFocus type="text" value={creating.label}
                onChange={e => setCreating(c => c ? { ...c, label: e.target.value } : c)}
                placeholder="z.B. Verpflegung"
                className={INPUT_CLS} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="cg-label block">Nummer</label>
                <input type="text" maxLength={3} value={creating.nummer}
                  onChange={e => setCreating(c => c ? { ...c, nummer: e.target.value } : c)}
                  className={`tnum text-center ${INPUT_CLS}`} />
              </div>
              <div className="space-y-1.5">
                <label className="cg-label block">Farbe</label>
                <input type="color" value={creating.farbe}
                  onChange={e => setCreating(c => c ? { ...c, farbe: e.target.value } : c)}
                  className="h-8 w-full cursor-pointer rounded-lg border border-line-strong bg-sunken" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="cg-label block">Länge (m)</label>
                <input type="number" step="1" min="1" value={creating.laengeM}
                  onChange={e => setCreating(c => c ? { ...c, laengeM: parseFloat(e.target.value) || 10 } : c)}
                  className={`tnum ${INPUT_CLS}`} />
              </div>
              <div className="space-y-1.5">
                <label className="cg-label block">Breite (m)</label>
                <input type="number" step="1" min="1" value={creating.breiteM}
                  onChange={e => setCreating(c => c ? { ...c, breiteM: parseFloat(e.target.value) || 10 } : c)}
                  className={`tnum ${INPUT_CLS}`} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setCreating(null)}>Abbrechen</Button>
              <Button variant="primary" className="flex-1" onClick={submitCreate}>Anlegen</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
