"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from 'wouter';

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

const STATUS_COLORS: Record<string, string> = {
  OFFEN: "bg-zinc-700 text-zinc-300",
  ANGEFRAGT: "bg-blue-900/60 text-blue-300",
  BESTAETIGT: "bg-amber-900/60 text-amber-300",
  VORHANDEN: "bg-emerald-900/60 text-emerald-300",
  GELIEFERT: "bg-emerald-800/80 text-emerald-200",
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
  const [filterGame, setFilterGame] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKat, setFilterKat] = useState("");

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
    if (filterStatus) params.set("status", filterStatus);
    if (filterKat) params.set("kategorie", filterKat);
    setLoading(true);
    fetch(`/api/materials?${params}`)
      .then((res) => res.json())
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGame, filterStatus, filterKat]);

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

  // Auswahl wird gepurged, sobald sich die sichtbare Liste ändert
  useEffect(() => {
    const visibleIds = new Set(items.map((i) => i.id));
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next;
    });
  }, [items]);

  const games = useMemo(
    () =>
      Array.from(
        new Map(
          items.filter((i) => i.game).map((i) => [i.game!.id, i.game!])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const stats = {
    total: items.length,
    offen: items.filter((i) => i.status === "OFFEN").length,
    bestaetigt: items.filter(
      (i) =>
        i.status === "BESTAETIGT" ||
        i.status === "VORHANDEN" ||
        i.status === "GELIEFERT"
    ).length,
  };
  const progressPct =
    stats.total > 0 ? Math.round((stats.bestaetigt / stats.total) * 100) : 0;

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && selected.size < items.length;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))
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
        `${selected.size} Material${selected.size === 1 ? "" : "ien"} wirklich löschen?`
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Material-Manager</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-zinc-500">
              {stats.total} Items &middot; {stats.offen} offen &middot;{" "}
              {stats.bestaetigt} gesichert
            </p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">{progressPct}%</span>
            </div>
          </div>
        </div>
        <Link
          to="/admin/materials/new"
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition"
        >
          + Neues Material
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterGame}
          onChange={(e) => setFilterGame(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Games</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={filterKat}
          onChange={(e) => setFilterKat(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Kategorien</option>
          {Object.entries(KAT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 border border-blue-800/60 bg-blue-950/30 rounded-lg px-4 py-2.5">
          <div className="text-sm text-blue-200">
            <span className="font-medium">{selected.size}</span> selektiert
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openBulk}
              className="px-3 py-1.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition"
            >
              Bearbeiten
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-sm font-medium text-red-300 border border-red-800 rounded-lg hover:bg-red-950 transition"
            >
              Löschen
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition"
            >
              Auswahl aufheben
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-zinc-500">
          Lade...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
          <p>Keine Materialien vorhanden</p>
          <Link
            to="/admin/materials/new"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Erstes Material anlegen
          </Link>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 text-left">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="accent-blue-500 cursor-pointer"
                    aria-label="Alle auswählen"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Game</th>
                <th className="px-4 py-3 font-medium">Kategorie</th>
                <th className="px-4 py-3 font-medium">Menge</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Verantwortlich</th>
                <th className="px-4 py-3 font-medium text-right">Kosten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((item) => {
                const isSel = selected.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSel ? "bg-blue-950/30" : "hover:bg-zinc-900/40"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(item.id)}
                        className="accent-blue-500 cursor-pointer"
                        aria-label={`${item.name} auswählen`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/materials/${item.id}`}
                        className="font-medium text-white hover:text-blue-400 transition"
                      >
                        {item.name}
                      </Link>
                      {item.sponsor && (
                        <span className="ml-2 text-xs text-zinc-500">
                          via {item.sponsor}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {item.game ? (
                        <Link
                          to={`/admin/games/${item.game.id}`}
                          className="hover:text-white transition"
                        >
                          {item.game.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-600">Allgemein</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {KAT_LABELS[item.kategorie] ?? item.kategorie}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {item.menge ?? "–"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_COLORS[item.status] ?? "bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {item.verantwortlich?.name ?? (
                        <span className="text-zinc-600">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                      {item.kostenGeschaetzt
                        ? `~CHF ${parseFloat(item.kostenGeschaetzt).toFixed(0)}`
                        : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950">
          <div>
            <h2 className="text-lg font-semibold">
              Gruppen-Bearbeitung
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {count} Material{count === 1 ? "" : "ien"} · Aktiviere die Felder,
              die geändert werden sollen
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition text-2xl leading-none"
            aria-label="Schliessen"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <BulkRow
            label="Game"
            enabled={patch.gameId.enabled}
            onToggle={(e) => update("gameId", { enabled: e })}
          >
            <select
              disabled={!patch.gameId.enabled}
              value={patch.gameId.value}
              onChange={(e) => update("gameId", { value: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40"
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-40 resize-none"
            />
          </BulkRow>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between sticky bottom-0 bg-zinc-950">
          <div className="text-xs text-zinc-500">
            {enabledCount} Feld{enabledCount === 1 ? "" : "er"} aktiv
            {error && <span className="ml-3 text-red-400">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              onClick={onSave}
              disabled={saving || enabledCount === 0}
              className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving
                ? "Speichert..."
                : `Auf ${count} anwenden`}
            </button>
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
    <div className="grid grid-cols-[auto_180px_1fr] items-center gap-3">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="accent-blue-500 cursor-pointer"
        aria-label={`${label} ändern`}
      />
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}
