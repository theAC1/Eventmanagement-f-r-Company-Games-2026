"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { ErgebnisFormular } from "@/components/ergebnis-formular";

type Ergebnis = {
  id: string;
  gamePunkte: number | null;
  status: string;
  eingetragenUm: string | null;
  rohdaten: Record<string, unknown>;
  game: { id: string; name: string; slug: string; wertungslogik?: unknown };
  team: { id: string; name: string; nummer: number };
  eingetragenVon: { id: string; name: string } | null;
  zeitplanSlot?: { id: string; startZeit: string } | null;
};

const KORREKTUR_FENSTER_MS = 5 * 60 * 1000;

function istGesperrt(eingetragenUm: string | null): boolean {
  if (!eingetragenUm) return false;
  return Date.now() - new Date(eingetragenUm).getTime() > KORREKTUR_FENSTER_MS;
}

const STATUS_OPTIONEN = ["", "EINGETRAGEN", "KORRIGIERT", "VERIFIZIERT"];

export default function AdminErgebnissePage() {
  const [entries, setEntries] = useState<Ergebnis[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGame, setFilterGame] = useState("");
  const [nurGesperrt, setNurGesperrt] = useState(false);
  const [editing, setEditing] = useState<Ergebnis | null>(null);

  const fetchErgebnisse = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          activity: "true",
          page: String(pageNum),
          limit: "50",
        });
        if (filterStatus) params.set("status", filterStatus);
        if (filterGame) params.set("gameId", filterGame);

        const res = await fetch(`/api/ergebnisse?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: Ergebnis[] = json.data ?? [];
        setEntries((prev) => (append ? [...prev, ...data] : data));
        setTotal(json.total ?? 0);
      } catch (err) {
        console.error("Ergebnisse fetch failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [filterStatus, filterGame],
  );

  useEffect(() => {
    setPage(1);
    fetchErgebnisse(1, false);
  }, [fetchErgebnisse]);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setGames(list.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
      })
      .catch(() => {});
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchErgebnisse(nextPage, true);
  };

  const sichtbar = nurGesperrt
    ? entries.filter((e) => istGesperrt(e.eingetragenUm))
    : entries;

  const hasMore = entries.length < total;

  const selectClass =
    "bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ergebnisse</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Alle eingetragenen Ergebnisse. Gesperrte Einträge (Korrekturfrist abgelaufen)
          können nur hier durch Admin/Orga überschrieben werden.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
          {STATUS_OPTIONEN.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "Alle Status" : s}
            </option>
          ))}
        </select>
        <select value={filterGame} onChange={(e) => setFilterGame(e.target.value)} className={selectClass}>
          <option value="">Alle Spiele</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={nurGesperrt}
            onChange={(e) => setNurGesperrt(e.target.checked)}
            className="accent-amber-500"
          />
          Nur gesperrte
        </label>
      </div>

      {/* Table */}
      {loading && entries.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Lade...</p>
      ) : sichtbar.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Keine Ergebnisse gefunden</p>
      ) : (
        <div className="overflow-x-auto border border-zinc-800 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                <th className="px-3 py-2 font-medium">Slot</th>
                <th className="px-3 py-2 font-medium">Game</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 font-medium">Schiedsrichter</th>
                <th className="px-3 py-2 font-medium text-right">Punkte</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sichtbar.map((e) => {
                const gesperrt = istGesperrt(e.eingetragenUm);
                return (
                  <tr key={e.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                    <td className="px-3 py-2 text-zinc-400 tabular-nums whitespace-nowrap">
                      {e.zeitplanSlot?.startZeit ??
                        (e.eingetragenUm
                          ? new Date(e.eingetragenUm).toLocaleTimeString("de-CH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "–")}
                    </td>
                    <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{e.game.name}</td>
                    <td className="px-3 py-2 text-zinc-200 whitespace-nowrap">
                      {e.team.name} <span className="text-zinc-500">#{e.team.nummer}</span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                      {e.eingetragenVon?.name ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {e.gamePunkte ?? "–"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={e.status} />
                        {gesperrt && e.status !== "VERIFIZIERT" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/40 text-red-400">
                            Gesperrt
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setEditing(e)}
                        className="px-3 py-1 text-xs border border-zinc-700 rounded-md hover:border-zinc-500 transition"
                      >
                        Bearbeiten
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !nurGesperrt && (
        <div className="text-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition disabled:opacity-50"
          >
            {loading ? "Lade..." : "Mehr laden"}
          </button>
        </div>
      )}

      {editing && (
        <AdminKorrekturModal
          ergebnis={editing}
          onClose={(refresh) => {
            setEditing(null);
            if (refresh) fetchErgebnisse(1, false);
          }}
        />
      )}
    </div>
  );
}

function AdminKorrekturModal({
  ergebnis,
  onClose,
}: {
  ergebnis: Ergebnis;
  onClose: (refresh?: boolean) => void;
}) {
  const [rohdaten, setRohdaten] = useState<Record<string, unknown>>(ergebnis.rohdaten ?? {});
  const [grund, setGrund] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ergebnisse/${ergebnis.id}/admin-korrektur`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rohdaten, grund: grund.trim() || undefined }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Fehler ${res.status}`);
      }
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onClose()} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto mx-4 p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Ergebnis korrigieren</h2>
          <p className="text-sm text-zinc-400">
            {ergebnis.game.name} — {ergebnis.team.name} #{ergebnis.team.nummer}
          </p>
          <p className="text-xs text-zinc-500">Status: {ergebnis.status}</p>
        </div>

        <ErgebnisFormular
          wertungslogik={
            (ergebnis.game.wertungslogik as Parameters<typeof ErgebnisFormular>[0]["wertungslogik"]) ?? null
          }
          rohdaten={rohdaten}
          onChange={setRohdaten}
        />

        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Grund der Korrektur (optional)</label>
          <textarea
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
            placeholder="z.B. Fehlmessung korrigiert..."
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => onClose()}
            className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {saving ? "Speichern..." : "Korrektur speichern & verifizieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
