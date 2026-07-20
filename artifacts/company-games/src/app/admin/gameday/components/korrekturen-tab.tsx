"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";

type HistoryEntry = {
  id: string;
  vorher: Record<string, unknown> | null;
  nachher: Record<string, unknown> | null;
  gamePunkteVorher: number | null;
  gamePunkteNachher: number | null;
  statusVorher: string | null;
  statusNachher: string | null;
  grund: string | null;
  geaendertUm: string;
  geaendertVon: { id: string; name: string } | null;
};

type KorrekturEntry = {
  id: string;
  gamePunkte: number | null;
  status: string;
  eingetragenUm: string | null;
  game: { id: string; name: string; slug: string };
  team: { id: string; name: string; nummer: number };
  eingetragenVon: { id: string; name: string } | null;
};

type KorrekturenTabProps = {
  games: { id: string; name: string; slug: string; modus: string; status: string }[];
  teams: { id: string; name: string; nummer: number }[];
};

export function KorrekturenTab({ games, teams }: KorrekturenTabProps) {
  const [entries, setEntries] = useState<KorrekturEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  // Filters
  const [filterGame, setFilterGame] = useState("");
  const [filterTeam, setFilterTeam] = useState("");

  const fetchKorrekturen = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          activity: "true",
          status: "KORRIGIERT",
          page: String(pageNum),
          limit: "50",
        });
        if (filterGame) params.set("gameId", filterGame);
        if (filterTeam) params.set("teamId", filterTeam);

        const res = await fetch(`/api/ergebnisse?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const data: KorrekturEntry[] = json.data ?? [];
        setEntries((prev) => (append ? [...prev, ...data] : data));
        setTotal(json.total ?? 0);
      } catch (err) {
        console.error("Korrekturen fetch failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [filterGame, filterTeam],
  );

  useEffect(() => {
    setPage(1);
    fetchKorrekturen(1, false);
  }, [fetchKorrekturen]);

  const handleToggle = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);

    // Load history if not cached
    if (!histories[id]) {
      setHistoryLoading(id);
      try {
        const res = await fetch(`/api/ergebnisse/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setHistories((prev) => ({
          ...prev,
          [id]: json.histories ?? [],
        }));
      } catch (err) {
        console.error("History fetch failed:", err);
      } finally {
        setHistoryLoading(null);
      }
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchKorrekturen(nextPage, true);
  };

  const hasMore = entries.length < total;

  const selectClass =
    "bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500";

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterGame}
          onChange={(e) => setFilterGame(e.target.value)}
          className={selectClass}
        >
          <option value="">Alle Spiele</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className={selectClass}
        >
          <option value="">Alle Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Entries */}
      {loading && entries.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Lade...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">
          Keine Korrekturen gefunden
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.id}>
              <button
                type="button"
                onClick={() => handleToggle(entry.id)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-2 border-amber-500 hover:bg-zinc-900/60 transition cursor-pointer"
              >
                <span className="text-xs text-zinc-600 w-14 shrink-0 tabular-nums">
                  {entry.eingetragenUm
                    ? new Date(entry.eingetragenUm).toLocaleTimeString(
                        "de-CH",
                        { hour: "2-digit", minute: "2-digit" },
                      )
                    : "–"}
                </span>

                <span className="text-xs text-zinc-500 w-24 truncate shrink-0">
                  {entry.eingetragenVon?.name ?? "–"}
                </span>

                <span className="text-sm text-zinc-300 w-32 truncate shrink-0">
                  {entry.game.name}
                </span>

                <span className="text-sm text-zinc-200 flex-1 truncate">
                  {entry.team.name}{" "}
                  <span className="text-zinc-500">#{entry.team.nummer}</span>
                </span>

                <span className="text-sm font-bold tabular-nums w-12 text-right shrink-0">
                  {entry.gamePunkte ?? "–"}
                </span>

                <StatusBadge status={entry.status} />

                <svg
                  className={`w-4 h-4 text-zinc-500 transition-transform ${expandedId === entry.id ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Expanded history */}
              {expandedId === entry.id && (
                <div className="ml-6 mt-2 mb-3 border-l border-zinc-800 pl-4 space-y-3">
                  {historyLoading === entry.id ? (
                    <p className="text-xs text-zinc-500">Lade History...</p>
                  ) : (histories[entry.id] ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-500">Keine History</p>
                  ) : (
                    (histories[entry.id] ?? []).map((h) => (
                      <HistoryItem key={h.id} history={h} />
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
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
    </div>
  );
}

function HistoryItem({ history }: { history: HistoryEntry }) {
  const vorher = history.vorher ?? {};
  const nachher = history.nachher ?? {};

  // Find changed fields
  const allKeys = new Set([...Object.keys(vorher), ...Object.keys(nachher)]);
  const changedFields: { key: string; before: unknown; after: unknown }[] = [];
  for (const key of allKeys) {
    if (JSON.stringify(vorher[key]) !== JSON.stringify(nachher[key])) {
      changedFields.push({
        key,
        before: vorher[key],
        after: nachher[key],
      });
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-600 tabular-nums">
          {new Date(history.geaendertUm).toLocaleTimeString("de-CH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        <span className="text-zinc-500">
          {history.geaendertVon?.name ?? "System"}
        </span>
        {history.gamePunkteVorher !== null &&
          history.gamePunkteNachher !== null && (
            <span className="text-zinc-400">
              Punkte: {history.gamePunkteVorher} → {history.gamePunkteNachher}
            </span>
          )}
      </div>

      {changedFields.length > 0 && (
        <div className="text-[11px] space-y-0.5">
          {changedFields.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <span className="text-zinc-500 w-20 truncate">{f.key}:</span>
              <span className="text-red-400/70 line-through">
                {String(f.before ?? "–")}
              </span>
              <span className="text-zinc-600">→</span>
              <span className="text-emerald-400/70">
                {String(f.after ?? "–")}
              </span>
            </div>
          ))}
        </div>
      )}

      {history.grund && (
        <p className="text-[11px] text-zinc-500 italic">
          Grund: {history.grund}
        </p>
      )}
    </div>
  );
}
