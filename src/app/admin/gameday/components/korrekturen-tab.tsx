"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useViewState } from "@/hooks/use-view-state";

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

const SELECT_CLASS =
  "h-[34px] rounded-[9px] border border-line-strong bg-sunken px-3 text-[13px] text-ink focus:border-action focus:outline-none";

const VIEW_ID = "admin:gameday:korrekturen";

/** Ansicht, die sich der Tab fuer die Dauer der Browser-Sitzung merkt. */
const DEFAULT_VIEW = {
  filterGame: "",
  filterTeam: "",
  expandedId: null as string | null,
};

export function KorrekturenTab({ games, teams }: KorrekturenTabProps) {
  const [entries, setEntries] = useState<KorrekturEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const { view, setView, ready } = useViewState(VIEW_ID, DEFAULT_VIEW);
  const { filterGame, filterTeam, expandedId } = view;

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

  // Erst laden, wenn die gemerkten Filter stehen.
  useEffect(() => {
    if (!ready) return;
    setPage(1);
    fetchKorrekturen(1, false);
  }, [ready, fetchKorrekturen]);

  /** Bereits angefragte Historien — verhindert Doppel-Fetches, ohne den Callback zu destabilisieren. */
  const requestedHistories = useRef<Set<string>>(new Set());

  const loadHistory = useCallback(async (id: string) => {
    if (requestedHistories.current.has(id)) return;
    requestedHistories.current.add(id);

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
      // Freigeben, damit ein erneutes Aufklappen es nochmal versucht.
      requestedHistories.current.delete(id);
      console.error("History fetch failed:", err);
    } finally {
      setHistoryLoading(null);
    }
  }, []);

  // Deckt beides ab: frisch aufgeklappt und aus der Sitzung wiederhergestellt.
  useEffect(() => {
    if (!ready || !expandedId) return;
    loadHistory(expandedId);
  }, [ready, expandedId, loadHistory]);

  const handleToggle = (id: string) => {
    setView((prev) => ({ expandedId: prev.expandedId === id ? null : id }));
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchKorrekturen(nextPage, true);
  };

  const hasMore = entries.length < total;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-[22px]">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2.5">
        <select
          value={filterGame}
          onChange={(e) => setView({ filterGame: e.target.value })}
          className={SELECT_CLASS}
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
          onChange={(e) => setView({ filterTeam: e.target.value })}
          className={SELECT_CLASS}
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
        <p className="py-8 text-center text-sm text-ink-3">Lade…</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">
          Keine Korrekturen gefunden
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <div key={entry.id}>
              <button
                type="button"
                onClick={() => handleToggle(entry.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-sunken/60"
              >
                <span className="tnum w-14 shrink-0 text-xs text-label">
                  {entry.eingetragenUm
                    ? new Date(entry.eingetragenUm).toLocaleTimeString(
                        "de-CH",
                        { hour: "2-digit", minute: "2-digit" },
                      )
                    : "–"}
                </span>

                <span className="w-24 shrink-0 truncate text-xs text-ink-3">
                  {entry.eingetragenVon?.name ?? "–"}
                </span>

                <span className="w-32 shrink-0 truncate text-sm text-ink-2">
                  {entry.game.name}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {entry.team.name}{" "}
                  <span className="tnum text-ink-3">#{entry.team.nummer}</span>
                </span>

                <span className="tnum w-12 shrink-0 text-right text-sm font-semibold text-ink">
                  {entry.gamePunkte ?? "–"}
                </span>

                <StatusBadge status={entry.status} />

                <CaretDown
                  size={15}
                  weight="bold"
                  className={`shrink-0 text-faint transition-transform duration-150 ${
                    expandedId === entry.id ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded history */}
              {expandedId === entry.id && (
                <div className="mb-3 ml-6 mt-2 flex flex-col gap-3 border-l border-line pl-4">
                  {historyLoading === entry.id ? (
                    <p className="text-xs text-ink-3">Lade History…</p>
                  ) : (histories[entry.id] ?? []).length === 0 ? (
                    <p className="text-xs text-ink-3">Keine History</p>
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
        <div className="pt-1 text-center">
          <Button variant="ghost" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Lade…" : "Mehr laden"}
          </Button>
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="tnum text-label">
          {new Date(history.geaendertUm).toLocaleTimeString("de-CH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        <span className="text-ink-3">
          {history.geaendertVon?.name ?? "System"}
        </span>
        {history.gamePunkteVorher !== null &&
          history.gamePunkteNachher !== null && (
            <span className="tnum text-ink-2">
              Punkte: {history.gamePunkteVorher} → {history.gamePunkteNachher}
            </span>
          )}
      </div>

      {changedFields.length > 0 && (
        <div className="flex flex-col gap-0.5 text-[11px]">
          {changedFields.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <span className="w-20 truncate text-ink-3">{f.key}:</span>
              <span className="tnum text-hot-tint line-through">
                {String(f.before ?? "–")}
              </span>
              <span className="text-faint">→</span>
              <span className="tnum text-done-tint">
                {String(f.after ?? "–")}
              </span>
            </div>
          ))}
        </div>
      )}

      {history.grund && (
        <p className="text-[11px] italic text-ink-3">
          Grund: {history.grund}
        </p>
      )}
    </div>
  );
}
