"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CaretDown,
  Check,
  Funnel,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { KpiBand, KpiCell } from "@/components/ui/kpi";
import { StatusPill, type PillTone } from "@/components/ui/pills";
import { ProgressBar } from "@/components/ui/progress";
import { Button, ButtonLink } from "@/components/ui/button";
import { useViewState } from "@/hooks/use-view-state";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { toggleInList } from "@/lib/view-state";

type MaterialItem = {
  id: string;
  name: string;
  kategorie: string;
  menge: string | null;
  status: string;
  sponsor: string | null;
  kostenGeschaetzt: string | null;
  kostenEffektiv: string | null;
  beschreibung?: string | null;
  gameId?: string | null;
  game: { id: string; name: string; slug: string } | null;
  verantwortlich: { id: string; name: string } | null;
  _count: { kommentare: number };
};

type GameOption = { id: string; name: string };
type PersonOption = { id: string; name: string; rolle: string };

const STATUS_TONES: Record<string, PillTone> = {
  OFFEN: "neutral",
  ANGEFRAGT: "action",
  BESTAETIGT: "warn",
  VORHANDEN: "done",
  GELIEFERT: "done-strong",
};

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  ANGEFRAGT: "Angefragt",
  BESTAETIGT: "Bestätigt",
  VORHANDEN: "Vorhanden",
  GELIEFERT: "Geliefert",
};

const KAT_LABELS: Record<string, string> = {
  SPONSOR: "Sponsor",
  MIETE: "Miete",
  KAUF: "Kauf",
  EIGENBAU: "Eigenbau",
  VERBRAUCH: "Verbrauch",
  INFRASTRUKTUR: "Infrastruktur",
};

const GESICHERT_STATI = new Set(["BESTAETIGT", "VORHANDEN", "GELIEFERT"]);

const ALLGEMEIN_KEY = "__allgemein__";
const ALLGEMEIN_LABEL = "Allgemein · Infrastruktur";

const INPUT_CLS =
  "w-full rounded-[9px] border border-line-strong bg-sunken px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-action focus:outline-none disabled:opacity-40 transition-colors duration-150";

const chf = (v: string | null | undefined): number => {
  if (v == null || v === "") return 0;
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

const fmtChf = (n: number): string => Math.round(n).toLocaleString("de-CH");

type BulkField =
  | "gameId"
  | "kategorie"
  | "status"
  | "verantwortlichId"
  | "menge"
  | "sponsor"
  | "kostenGeschaetzt"
  | "kostenEffektiv"
  | "beschreibung";

type BulkPatchState = {
  [K in BulkField]: { enabled: boolean; value: string };
};

/** Ansicht, die sich die Seite fuer die Dauer der Browser-Sitzung merkt. */
type MaterialsView = {
  filterGame: string;
  filterStatus: string;
  filterKat: string;
  search: string;
  /** Keys der zugeklappten Gruppen — als Liste, weil ein Set nicht serialisierbar ist. */
  collapsed: string[];
};

const VIEW_ID = "admin:materials";

const DEFAULT_VIEW: MaterialsView = {
  filterGame: "",
  filterStatus: "",
  filterKat: "",
  search: "",
  collapsed: [],
};

const INITIAL_BULK_PATCH: BulkPatchState = {
  gameId: { enabled: false, value: "" },
  kategorie: { enabled: false, value: "SPONSOR" },
  status: { enabled: false, value: "OFFEN" },
  verantwortlichId: { enabled: false, value: "" },
  menge: { enabled: false, value: "" },
  sponsor: { enabled: false, value: "" },
  kostenGeschaetzt: { enabled: false, value: "" },
  kostenEffektiv: { enabled: false, value: "" },
  beschreibung: { enabled: false, value: "" },
};

export default function MaterialsPage() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { view, setView, ready } = useViewState(VIEW_ID, DEFAULT_VIEW);
  const { filterGame, filterStatus, filterKat, search } = view;
  const collapsed = useMemo(() => new Set(view.collapsed), [view.collapsed]);

  useScrollRestore(VIEW_ID, ready && !loading);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPatch, setBulkPatch] = useState<BulkPatchState>(INITIAL_BULK_PATCH);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [personOptions, setPersonOptions] = useState<PersonOption[]>([]);

  const reload = () => {
    const params = new URLSearchParams();
    if (filterGame) params.set("gameId", filterGame);
    if (filterKat) params.set("kategorie", filterKat);
    setLoading(true);
    fetch(`/api/materials?${params}`)
      .then((res) => res.json())
      .then(setItems)
      .finally(() => setLoading(false));
  };

  // Erst laden, wenn die gemerkten Filter stehen — sonst holt der erste Fetch
  // die ungefilterte Liste, die gleich darauf wieder verworfen wird.
  useEffect(() => {
    if (!ready) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filterGame, filterKat]);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((d: GameOption[]) =>
        setGameOptions(d.map((g) => ({ id: g.id, name: g.name })))
      )
      .catch(() => {});
    fetch("/api/persons")
      .then((r) => r.json())
      .then((d: PersonOption[]) => setPersonOptions(d))
      .catch(() => {});
  }, []);

  // Suche + Status filtern clientseitig
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filterStatus && i.status !== filterStatus) return false;
      if (!q) return true;
      const hay = [
        i.name,
        i.sponsor ?? "",
        i.beschreibung ?? "",
        i.menge ?? "",
        KAT_LABELS[i.kategorie] ?? i.kategorie,
        i.game?.name ?? ALLGEMEIN_LABEL,
        i.verantwortlich?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, filterStatus, search]);

  // Auswahl wird gepurged, sobald sich die sichtbare Liste ändert
  useEffect(() => {
    const visibleIds = new Set(filtered.map((i) => i.id));
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next;
    });
  }, [filtered]);

  const games = useMemo(
    () =>
      Array.from(
        new Map(
          items.filter((i) => i.game).map((i) => [i.game!.id, i.game!])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const stats = useMemo(() => {
    const gesichert = items.filter((i) => GESICHERT_STATI.has(i.status)).length;
    return {
      total: items.length,
      offen: items.filter((i) => i.status === "OFFEN").length,
      gesichert,
      kostenGeschaetzt: items.reduce((s, i) => s + chf(i.kostenGeschaetzt), 0),
      kostenEffektiv: items.reduce((s, i) => s + chf(i.kostenEffektiv), 0),
    };
  }, [items]);
  const progressPct =
    stats.total > 0 ? Math.round((stats.gesichert / stats.total) * 100) : 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of items) counts[i.status] = (counts[i.status] ?? 0) + 1;
    return counts;
  }, [items]);

  // Gruppierung nach Game
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; items: MaterialItem[] }>();
    for (const i of filtered) {
      const key = i.game?.id ?? ALLGEMEIN_KEY;
      const name = i.game?.name ?? ALLGEMEIN_LABEL;
      if (!map.has(key)) map.set(key, { key, name, items: [] });
      map.get(key)!.items.push(i);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === ALLGEMEIN_KEY) return -1;
      if (b.key === ALLGEMEIN_KEY) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const toggleGroup = (key: string) => {
    setView((prev) => ({ collapsed: toggleInList(prev.collapsed, key) }));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((i) => i.id))
    );
  };

  const openBulk = () => {
    setBulkPatch(INITIAL_BULK_PATCH);
    setBulkError(null);
    setBulkOpen(true);
  };

  const closeBulk = () => {
    if (bulkSaving) return;
    setBulkOpen(false);
  };

  const buildPatchPayload = (): Record<string, unknown> | null => {
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(bulkPatch) as BulkField[]) {
      const f = bulkPatch[key];
      if (!f.enabled) continue;
      const v = f.value;
      switch (key) {
        case "gameId":
          patch.gameId = v ? v : null;
          break;
        case "verantwortlichId":
          patch.verantwortlichId = v ? v : null;
          break;
        case "kategorie":
          patch.kategorie = v;
          break;
        case "status":
          patch.status = v;
          break;
        case "menge":
        case "sponsor":
        case "beschreibung":
          patch[key] = v.trim() === "" ? null : v;
          break;
        case "kostenGeschaetzt":
        case "kostenEffektiv":
          if (v.trim() === "") patch[key] = null;
          else {
            const n = parseFloat(v);
            if (Number.isNaN(n)) return null;
            patch[key] = n;
          }
          break;
      }
    }
    return patch;
  };

  const enabledCount = (Object.keys(bulkPatch) as BulkField[]).filter(
    (k) => bulkPatch[k].enabled
  ).length;

  const handleBulkSave = async () => {
    setBulkError(null);
    const patch = buildPatchPayload();
    if (patch === null) {
      setBulkError("Ungültige Zahl bei Kosten");
      return;
    }
    if (Object.keys(patch).length === 0) {
      setBulkError("Mindestens ein Feld auswählen");
      return;
    }

    setBulkSaving(true);
    try {
      const res = await fetch("/api/materials/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), patch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Fehler beim Speichern");
      }
      setBulkOpen(false);
      setSelected(new Set());
      reload();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `${selected.size} Position${selected.size === 1 ? "" : "en"} wirklich löschen?`
      )
    )
      return;
    try {
      const res = await fetch("/api/materials/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      setSelected(new Set());
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler");
    }
  };

  const filterChips: { value: string; label: string; count: number }[] = [
    { value: "", label: "Alle", count: stats.total },
    ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
      count: statusCounts[value] ?? 0,
    })),
  ];

  return (
    <>
      <TopBar title="Material">
        <span className="hidden text-[13px] text-ink-3 sm:inline">
          <span className="tnum text-ink-2">{stats.total}</span> Positionen
        </span>
        <TopBarSpacer />
        <label className="relative hidden md:block">
          <MagnifyingGlass
            size={15}
            weight="bold"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setView({ search: e.target.value })}
            placeholder="Position suchen"
            className="h-[34px] w-[200px] rounded-[9px] border border-line-strong bg-transparent pl-9 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-action focus:outline-none transition-colors duration-150"
          />
        </label>
        <ButtonLink href="/admin/materials/new" variant="primary">
          <Plus size={15} weight="bold" />
          Neue Position
        </ButtonLink>
      </TopBar>

      {/* KPI-Band */}
      <KpiBand columns="1.4fr 1fr 1fr 1fr" className="max-sm:grid-cols-2!">
        <div className="flex flex-col gap-1.5 border-r border-line px-4 py-4 sm:px-[22px]">
          <span className="cg-label">Gesichert</span>
          <div className="flex items-baseline gap-1.5">
            <span className="tnum text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink">
              {stats.gesichert}
            </span>
            <span className="tnum text-sm text-ink-3">/{stats.total}</span>
            <span className="tnum text-[13px] font-semibold text-done">
              {progressPct} %
            </span>
          </div>
          <ProgressBar
            pct={progressPct}
            color="var(--done)"
            height={3}
            className="mt-1 max-w-[280px]"
          />
        </div>
        <KpiCell
          label="Offen"
          value={stats.offen}
          valueColor="var(--warn)"
          note="ohne Zusage"
        />
        <KpiCell
          label="Kosten geschätzt"
          value={fmtChf(stats.kostenGeschaetzt)}
          unit="CHF"
        />
        <KpiCell
          label="Effektiv verbucht"
          value={fmtChf(stats.kostenEffektiv)}
          unit="CHF"
          valueColor="var(--done)"
          last
        />
      </KpiBand>

      {/* Filter-Chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3.5 sm:px-[22px]">
        {filterChips.map((c) => {
          const active = filterStatus === c.value;
          return (
            <button
              key={c.value || "alle"}
              type="button"
              onClick={() => setView({ filterStatus: c.value })}
              className={`inline-flex h-[30px] items-center gap-[7px] rounded-full px-3 text-xs transition-colors duration-150 ${
                active
                  ? "border border-ink bg-ink font-semibold text-bg"
                  : "border border-line-strong text-ink-3 hover:text-ink-2"
              }`}
            >
              {c.label}
              <span className="tnum text-label">{c.count}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex h-[30px] items-center rounded-full border border-line-strong px-3 text-xs text-ink-3 transition-colors duration-150 hover:text-ink-2"
        >
          {allSelected ? "Auswahl aufheben" : "Alle auswählen"}
        </button>
        <span className="flex-1" aria-hidden />
        <div className="flex items-center gap-2">
          <span className="inline-flex h-[30px] items-center gap-[7px] rounded-full border border-line-strong pl-3 pr-1 text-xs text-ink-3">
            <Funnel size={13} weight="bold" />
            <select
              value={filterGame}
              onChange={(e) => setView({ filterGame: e.target.value })}
              className="h-full max-w-[150px] rounded-full bg-transparent pr-1 text-xs text-ink-3 focus:outline-none"
              aria-label="Nach Game filtern"
            >
              <option value="">Alle Games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </span>
          <span className="inline-flex h-[30px] items-center rounded-full border border-line-strong px-1 text-xs text-ink-3">
            <select
              value={filterKat}
              onChange={(e) => setView({ filterKat: e.target.value })}
              className="h-full max-w-[140px] rounded-full bg-transparent px-2 text-xs text-ink-3 focus:outline-none"
              aria-label="Nach Kategorie filtern"
            >
              <option value="">Alle Kategorien</option>
              {Object.entries(KAT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>

      {/* Bulk-Bar */}
      {selected.size > 0 && (
        <div
          className="mx-4 mt-3.5 flex h-auto min-h-[46px] flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border bg-action-dim px-3.5 py-1.5 sm:mx-[22px] sm:h-[46px] sm:flex-nowrap sm:py-0"
          style={{
            borderColor: "color-mix(in srgb, var(--action) 45%, transparent)",
          }}
        >
          <span className="text-[13px] text-action-tint">
            <span className="tnum font-bold">{selected.size}</span> Positionen
            ausgewählt
          </span>
          <span className="flex-1" aria-hidden />
          <Button variant="primary" className="h-8" onClick={openBulk}>
            Bearbeiten
          </Button>
          <Button
            variant="danger-ghost"
            className="h-8"
            onClick={handleBulkDelete}
          >
            Löschen
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-ink-3 transition-colors duration-150 hover:text-ink"
          >
            Aufheben
          </button>
        </div>
      )}

      {/* Gruppierte Liste */}
      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-ink-3">
          Lade...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-ink-3">
          <p>Keine Positionen gefunden</p>
          <Link
            href="/admin/materials/new"
            className="text-[13px] text-action transition-colors duration-150 hover:text-ink"
          >
            Erste Position anlegen
          </Link>
        </div>
      ) : (
        <div className="anim-rise px-4 pb-10 pt-2.5 sm:px-[22px]">
          {groups.map((g) => {
            const gesichert = g.items.filter((i) =>
              GESICHERT_STATI.has(i.status)
            ).length;
            const pct =
              g.items.length > 0
                ? Math.round((gesichert / g.items.length) * 100)
                : 0;
            const kosten = g.items.reduce(
              (s, i) => s + chf(i.kostenGeschaetzt),
              0
            );
            const isCollapsed = collapsed.has(g.key);
            return (
              <div key={g.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.key)}
                  className="flex h-[38px] w-full items-center gap-2.5 text-left"
                  aria-expanded={!isCollapsed}
                >
                  <CaretDown
                    size={13}
                    weight="bold"
                    className={`shrink-0 text-ink-3 transition-transform duration-150 ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {g.name}
                  </span>
                  <span className="tnum shrink-0 text-[11px] text-ink-3">
                    {g.items.length} Positionen
                  </span>
                  <span className="hidden items-center gap-2 sm:flex">
                    <ProgressBar
                      pct={pct}
                      color={pct >= 75 ? "var(--done)" : "var(--warn)"}
                      height={4}
                      className="w-[90px]"
                    />
                    <span className="whitespace-nowrap text-[11px] text-ink-3">
                      <span className="tnum">{pct} %</span> gesichert
                    </span>
                  </span>
                  <span className="flex-1" aria-hidden />
                  <span className="tnum shrink-0 text-[11px] text-ink-3">
                    CHF {fmtChf(kosten)}
                  </span>
                </button>
                {!isCollapsed &&
                  g.items.map((item) => (
                    <MaterialRow
                      key={item.id}
                      item={item}
                      selected={selected.has(item.id)}
                      onToggle={() => toggleOne(item.id)}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk-Edit Modal */}
      {bulkOpen && (
        <BulkEditModal
          count={selected.size}
          patch={bulkPatch}
          setPatch={setBulkPatch}
          enabledCount={enabledCount}
          gameOptions={gameOptions}
          personOptions={personOptions}
          saving={bulkSaving}
          error={bulkError}
          onSave={handleBulkSave}
          onClose={closeBulk}
        />
      )}
    </>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150 ${
        checked
          ? "border-action bg-action text-on-action"
          : "border-line-key bg-transparent hover:border-action"
      }`}
    >
      {checked && <Check size={10} weight="bold" />}
    </button>
  );
}

function MaterialRow({
  item,
  selected,
  onToggle,
}: {
  item: MaterialItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const sub = item.sponsor
    ? `via ${item.sponsor}`
    : (item.beschreibung ?? null);
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-line-soft px-3 py-2.5 transition-colors duration-150 lg:grid lg:h-[50px] lg:grid-cols-[22px_1fr_118px_132px_150px_116px_96px] lg:py-0 ${
        selected ? "bg-action-row" : "hover:bg-sunken/60"
      }`}
    >
      <Checkbox
        checked={selected}
        onChange={onToggle}
        label={`${item.name} auswählen`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-none">
        <Link
          href={`/admin/materials/${item.id}`}
          className="truncate text-[13px] font-medium text-ink transition-colors duration-150 hover:text-action"
        >
          {item.name}
        </Link>
        {sub && <span className="truncate text-[11px] text-ink-3">{sub}</span>}
      </div>
      <span className="hidden text-xs text-ink-3 lg:block">
        {KAT_LABELS[item.kategorie] ?? item.kategorie}
      </span>
      <span className="tnum hidden text-xs text-ink-3 lg:block">
        {item.menge ?? "–"}
      </span>
      <span className="hidden truncate text-xs text-ink-3 lg:block">
        {item.verantwortlich?.name ?? "–"}
      </span>
      <span className="lg:justify-self-start">
        <StatusPill tone={STATUS_TONES[item.status] ?? "neutral"}>
          {STATUS_LABELS[item.status] ?? item.status}
        </StatusPill>
      </span>
      <span className="tnum hidden text-right text-xs text-ink-3 lg:block">
        {item.kostenGeschaetzt ? fmtChf(chf(item.kostenGeschaetzt)) : "–"}
      </span>
      {/* Mobile-Meta */}
      <span className="flex w-full flex-wrap gap-x-3 pl-[27px] text-[11px] text-ink-3 lg:hidden">
        <span>{KAT_LABELS[item.kategorie] ?? item.kategorie}</span>
        {item.menge && <span className="tnum">{item.menge}</span>}
        {item.verantwortlich && <span>{item.verantwortlich.name}</span>}
        {item.kostenGeschaetzt && (
          <span className="tnum">
            CHF {fmtChf(chf(item.kostenGeschaetzt))}
          </span>
        )}
      </span>
    </div>
  );
}

function BulkEditModal({
  count,
  patch,
  setPatch,
  enabledCount,
  gameOptions,
  personOptions,
  saving,
  error,
  onSave,
  onClose,
}: {
  count: number;
  patch: BulkPatchState;
  setPatch: (p: BulkPatchState) => void;
  enabledCount: number;
  gameOptions: GameOption[];
  personOptions: PersonOption[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const update = (key: BulkField, partial: Partial<BulkPatchState[BulkField]>) => {
    setPatch({ ...patch, [key]: { ...patch[key], ...partial } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Positionen bearbeiten"
        className="anim-pop max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[14px] border border-line bg-surface"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Gruppen-Bearbeitung
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-3">
              <span className="tnum">{count}</span> Position
              {count === 1 ? "" : "en"} · Aktiviere die Felder, die geändert
              werden sollen
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 transition-colors duration-150 hover:text-ink"
            aria-label="Schliessen"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <BulkRow
            label="Game"
            enabled={patch.gameId.enabled}
            onToggle={(e) => update("gameId", { enabled: e })}
          >
            <select
              disabled={!patch.gameId.enabled}
              value={patch.gameId.value}
              onChange={(e) => update("gameId", { value: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">Allgemein (kein Game)</option>
              {gameOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </BulkRow>

          <BulkRow
            label="Kategorie"
            enabled={patch.kategorie.enabled}
            onToggle={(e) => update("kategorie", { enabled: e })}
          >
            <select
              disabled={!patch.kategorie.enabled}
              value={patch.kategorie.value}
              onChange={(e) => update("kategorie", { value: e.target.value })}
              className={INPUT_CLS}
            >
              {Object.entries(KAT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </BulkRow>

          <BulkRow
            label="Status"
            enabled={patch.status.enabled}
            onToggle={(e) => update("status", { enabled: e })}
          >
            <select
              disabled={!patch.status.enabled}
              value={patch.status.value}
              onChange={(e) => update("status", { value: e.target.value })}
              className={INPUT_CLS}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </BulkRow>

          <BulkRow
            label="Verantwortlich"
            enabled={patch.verantwortlichId.enabled}
            onToggle={(e) => update("verantwortlichId", { enabled: e })}
          >
            <select
              disabled={!patch.verantwortlichId.enabled}
              value={patch.verantwortlichId.value}
              onChange={(e) =>
                update("verantwortlichId", { value: e.target.value })
              }
              className={INPUT_CLS}
            >
              <option value="">Niemand (entfernen)</option>
              {personOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.rolle})
                </option>
              ))}
            </select>
          </BulkRow>

          <BulkRow
            label="Menge"
            enabled={patch.menge.enabled}
            onToggle={(e) => update("menge", { enabled: e })}
          >
            <input
              type="text"
              disabled={!patch.menge.enabled}
              value={patch.menge.value}
              onChange={(e) => update("menge", { value: e.target.value })}
              placeholder="z.B. 100 Stk. (leer = entfernen)"
              className={INPUT_CLS}
            />
          </BulkRow>

          <BulkRow
            label="Sponsor"
            enabled={patch.sponsor.enabled}
            onToggle={(e) => update("sponsor", { enabled: e })}
          >
            <input
              type="text"
              disabled={!patch.sponsor.enabled}
              value={patch.sponsor.value}
              onChange={(e) => update("sponsor", { value: e.target.value })}
              placeholder="(leer = entfernen)"
              className={INPUT_CLS}
            />
          </BulkRow>

          <BulkRow
            label="Kosten geschätzt (CHF)"
            enabled={patch.kostenGeschaetzt.enabled}
            onToggle={(e) => update("kostenGeschaetzt", { enabled: e })}
          >
            <input
              type="number"
              step="0.01"
              disabled={!patch.kostenGeschaetzt.enabled}
              value={patch.kostenGeschaetzt.value}
              onChange={(e) =>
                update("kostenGeschaetzt", { value: e.target.value })
              }
              placeholder="(leer = entfernen)"
              className={`${INPUT_CLS} tnum`}
            />
          </BulkRow>

          <BulkRow
            label="Kosten effektiv (CHF)"
            enabled={patch.kostenEffektiv.enabled}
            onToggle={(e) => update("kostenEffektiv", { enabled: e })}
          >
            <input
              type="number"
              step="0.01"
              disabled={!patch.kostenEffektiv.enabled}
              value={patch.kostenEffektiv.value}
              onChange={(e) =>
                update("kostenEffektiv", { value: e.target.value })
              }
              placeholder="(leer = entfernen)"
              className={`${INPUT_CLS} tnum`}
            />
          </BulkRow>

          <BulkRow
            label="Beschreibung"
            enabled={patch.beschreibung.enabled}
            onToggle={(e) => update("beschreibung", { enabled: e })}
          >
            <textarea
              disabled={!patch.beschreibung.enabled}
              value={patch.beschreibung.value}
              onChange={(e) => update("beschreibung", { value: e.target.value })}
              rows={3}
              placeholder="(leer = entfernen) — überschreibt bei allen!"
              className={`${INPUT_CLS} resize-none`}
            />
          </BulkRow>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
          <div className="text-[11px] text-ink-3">
            <span className="tnum">{enabledCount}</span> Feld
            {enabledCount === 1 ? "" : "er"} aktiv
            {error && <span className="ml-3 text-hot-tint">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              onClick={onSave}
              disabled={saving || enabledCount === 0}
            >
              {saving ? "Speichert..." : `Auf ${count} anwenden`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkRow({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 sm:grid-cols-[auto_180px_1fr]">
      <Checkbox checked={enabled} onChange={() => onToggle(!enabled)} label={`${label} ändern`} />
      <label className="cg-label">{label}</label>
      <div className="col-span-2 sm:col-span-1">{children}</div>
    </div>
  );
}
