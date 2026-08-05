"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { ModusChip } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";
import { KorrekturModal } from "./korrektur-modal";

type GameInfo = {
  id: string;
  name: string;
  slug: string;
  modus: string;
  status: string;
};

type TeamInfo = {
  id: string;
  name: string;
  nummer: number;
};

type ActivityEntry = {
  id: string;
  gamePunkte: number | null;
  status: string;
  eingetragenUm: string | null;
  rohdaten: Record<string, unknown>;
  commitId?: string | null;
  game: { id: string; name: string; slug: string; wertungslogik?: unknown };
  team: { id: string; name: string; nummer: number };
  eingetragenVon: { id: string; name: string } | null;
};

type CommitGroup = {
  commitId: string;
  entries: ActivityEntry[];
  timestamp: string | null;
  schiedsrichter: string;
  gameName: string;
  status: string;
};

function groupByCommit(entries: ActivityEntry[]): CommitGroup[] {
  const groups = new Map<string, ActivityEntry[]>();

  for (const entry of entries) {
    // Einträge ohne commitId werden einzeln behandelt
    const key = entry.commitId || `solo_${entry.id}`;
    const existing = groups.get(key) || [];
    existing.push(entry);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([commitId, items]) => ({
    commitId,
    entries: items,
    timestamp: items[0].eingetragenUm,
    schiedsrichter: items[0].eingetragenVon?.name ?? "–",
    gameName: items[0].game.name,
    status: items[0].status,
  }));
}

type AktivitaetTabProps = {
  games: GameInfo[];
  teams: TeamInfo[];
  initialGameFilter?: string;
};

const SELECT_CLASS =
  "h-[34px] rounded-[9px] border border-line-strong bg-sunken px-3 text-[13px] text-ink focus:border-action focus:outline-none";

export function AktivitaetTab({
  games,
  teams,
  initialGameFilter,
}: AktivitaetTabProps) {
  const canCorrect = true;

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterGame, setFilterGame] = useState(initialGameFilter ?? "");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [modalEntry, setModalEntry] = useState<ActivityEntry | null>(null);

  const fetchActivity = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          activity: "true",
          page: String(pageNum),
          limit: "50",
        });
        if (filterGame) params.set("gameId", filterGame);
        if (filterTeam) params.set("teamId", filterTeam);
        if (filterStatus) params.set("status", filterStatus);

        const res = await fetch(`/api/ergebnisse?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const data: ActivityEntry[] = json.data ?? [];
        setEntries((prev) => (append ? [...prev, ...data] : data));
        setTotal(json.total ?? 0);
      } catch (err) {
        console.error("Activity fetch failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [filterGame, filterTeam, filterStatus],
  );

  useEffect(() => {
    setPage(1);
    fetchActivity(1, false);
  }, [fetchActivity]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivity(nextPage, true);
  };

  const handleModalClose = (refreshNeeded?: boolean) => {
    setModalEntry(null);
    if (refreshNeeded) {
      setPage(1);
      fetchActivity(1, false);
    }
  };

  const hasMore = entries.length < total;
  const commitGroups = groupByCommit(entries);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-[22px]">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2.5">
        <select
          value={filterGame}
          onChange={(e) => setFilterGame(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Alle Spiele</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Alle Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Alle Status</option>
          <option value="EINGETRAGEN">Eingetragen</option>
          <option value="KORRIGIERT">Korrigiert</option>
          <option value="VERIFIZIERT">Verifiziert</option>
          <option value="LAUFEND">Läuft</option>
        </select>
      </div>

      {/* Commit Groups */}
      {loading && entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">Lade…</p>
      ) : commitGroups.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">
          Keine Einträge gefunden
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {commitGroups.map((group) => {
            const isDuell = group.entries.length > 1;

            return (
              <div
                key={group.commitId}
                className="rounded-[10px] border border-line bg-surface"
              >
                {/* Commit Header */}
                <div className="flex items-center gap-3 px-3.5 py-2 text-xs">
                  <span className="tnum w-14 shrink-0 text-label">
                    {group.timestamp
                      ? new Date(group.timestamp).toLocaleTimeString("de-CH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "–"}
                  </span>
                  <span className="w-24 shrink-0 truncate text-ink-3">
                    {group.schiedsrichter}
                  </span>
                  <span className="truncate font-medium text-ink">
                    {group.gameName}
                  </span>
                  {isDuell && <ModusChip modus="DUELL" size="table" />}
                  <span className="flex-1" />
                  <StatusBadge status={group.status} />
                </div>

                {/* Entries in this commit */}
                {group.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={!canCorrect}
                    onClick={() => canCorrect && setModalEntry(entry)}
                    className={`flex w-full items-center gap-3 border-t border-line-soft px-3.5 py-2 text-left transition-colors duration-150 ${
                      canCorrect ? "cursor-pointer hover:bg-sunken/60" : "cursor-default"
                    }`}
                  >
                    <span className="w-14 shrink-0" />
                    <span className="w-24 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {entry.team.name}{" "}
                      <span className="tnum text-ink-3">#{entry.team.nummer}</span>
                    </span>
                    <span className="tnum w-16 shrink-0 text-right text-sm font-semibold text-ink">
                      {entry.gamePunkte ?? "–"}
                    </span>
                    {isDuell && <StatusBadge status={entry.status} />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Mehr laden */}
      {hasMore && (
        <div className="pt-1 text-center">
          <Button variant="ghost" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Lade…" : "Mehr laden"}
          </Button>
        </div>
      )}

      {/* Korrektur-Modal */}
      {modalEntry && (
        <KorrekturModal ergebnis={modalEntry} onClose={handleModalClose} />
      )}
    </div>
  );
}
