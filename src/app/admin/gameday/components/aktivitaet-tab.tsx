"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { StatusBadge } from "@/components/status-badge";
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
  game: { id: string; name: string; slug: string; wertungslogik?: unknown };
  team: { id: string; name: string; nummer: number };
  eingetragenVon: { id: string; name: string } | null;
};

type AktivitaetTabProps = {
  games: GameInfo[];
  teams: TeamInfo[];
};

export function AktivitaetTab({ games, teams }: AktivitaetTabProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const canCorrect = userRole === "ORGA" || userRole === "ADMIN";

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterGame, setFilterGame] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modal
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

  // Reset page + reload when filters change
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

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">Alle Status</option>
          <option value="EINGETRAGEN">Eingetragen</option>
          <option value="KORRIGIERT">Korrigiert</option>
          <option value="VERIFIZIERT">Verifiziert</option>
          <option value="LAUFEND">Läuft</option>
        </select>
      </div>

      {/* Entries */}
      {loading && entries.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Lade...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">
          Keine Einträge gefunden
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const isKorrigiert = entry.status === "KORRIGIERT";
            return (
              <button
                key={entry.id}
                type="button"
                disabled={!canCorrect}
                onClick={() => canCorrect && setModalEntry(entry)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                  isKorrigiert ? "border-l-2 border-amber-500" : ""
                } ${
                  canCorrect
                    ? "hover:bg-zinc-900/60 cursor-pointer"
                    : "cursor-default"
                }`}
              >
                {/* Timestamp */}
                <span className="text-xs text-zinc-600 w-14 shrink-0 tabular-nums">
                  {entry.eingetragenUm
                    ? new Date(entry.eingetragenUm).toLocaleTimeString(
                        "de-CH",
                        { hour: "2-digit", minute: "2-digit" },
                      )
                    : "–"}
                </span>

                {/* Schiedsrichter */}
                <span className="text-xs text-zinc-500 w-24 truncate shrink-0">
                  {entry.eingetragenVon?.name ?? "–"}
                </span>

                {/* Game */}
                <span className="text-sm text-zinc-300 w-32 truncate shrink-0">
                  {entry.game.name}
                </span>

                {/* Team */}
                <span className="text-sm text-zinc-200 flex-1 truncate">
                  {entry.team.name}{" "}
                  <span className="text-zinc-500">#{entry.team.nummer}</span>
                </span>

                {/* Punkte */}
                <span className="text-sm font-bold tabular-nums w-12 text-right shrink-0">
                  {entry.gamePunkte ?? "–"}
                </span>

                {/* Status */}
                <StatusBadge status={entry.status} />
              </button>
            );
          })}
        </div>
      )}

      {/* Mehr laden */}
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

      {/* Korrektur-Modal */}
      {modalEntry && (
        <KorrekturModal ergebnis={modalEntry} onClose={handleModalClose} />
      )}
    </div>
  );
}
