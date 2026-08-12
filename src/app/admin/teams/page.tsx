"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Warning } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { apiFetch, apiSend } from "@/lib/api-client";
import { meldung } from "@/lib/api-fehler";

type Team = {
  id: string; name: string; nummer: number; farbe: string;
  captainName: string | null; teilnehmerAnzahl: number | null;
  logoUrl: string | null; motto: string | null; qrToken: string;
};

const GRID_COLS = "36px 1.3fr 150px 90px 1fr 52px 90px";

const INPUT_CLASS =
  "h-[34px] rounded-[9px] border border-line-strong bg-sunken px-3 text-[13px] text-ink outline-none transition-colors duration-150 placeholder:text-label focus:border-action";

type LoeschAntwort = { folgen?: string[] };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNummer, setNewNummer] = useState(1);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useScrollRestore("admin:teams", !loading);

  const load = useCallback(async () => {
    try {
      setTeams(await apiFetch<Team[]>("/api/teams"));
      setFehler(null);
    } catch (err) {
      setFehler(meldung(err, "Teams konnten nicht geladen werden."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createTeam = async () => {
    if (!newName.trim()) return;
    try {
      await apiSend("/api/teams", "POST", { name: newName, nummer: newNummer });
      setNewName("");
      setNewNummer(newNummer + 1);
      setShowNew(false);
      setFehler(null);
      await load();
    } catch (err) {
      setFehler(meldung(err, "Team konnte nicht erstellt werden."));
    }
  };

  const deleteTeam = async (team: Team) => {
    if (!confirm(`Team "${team.name}" wirklich löschen?`)) return;
    setFehler(null);
    setHinweis(null);
    try {
      const antwort = await apiSend<LoeschAntwort>(`/api/teams/${team.id}`, "DELETE");
      if (antwort.folgen && antwort.folgen.length > 0) {
        setHinweis(`"${team.name}" gelöscht. ${antwort.folgen.join(" ")}`);
      }
      await load();
    } catch (err) {
      setFehler(meldung(err, "Team konnte nicht gelöscht werden."));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Teams">
        <span className="tnum text-xs text-ink-3">{teams.length} Teams</span>
        <TopBarSpacer />
        {showNew ? (
          <>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              placeholder="Teamname, z.B. Die Löwen"
              className={`${INPUT_CLASS} w-[170px] sm:w-[210px]`}
            />
            <input
              type="number"
              value={newNummer}
              onChange={e => setNewNummer(parseInt(e.target.value) || 1)}
              className={`${INPUT_CLASS} tnum w-[64px]`}
              aria-label="Team-Nummer"
            />
            <Button variant="primary" onClick={createTeam}>
              Erstellen
            </Button>
            <button
              onClick={() => setShowNew(false)}
              className="text-[13px] font-medium text-ink-3 transition-colors duration-150 hover:text-ink"
            >
              Abbrechen
            </button>
          </>
        ) : (
          <Button
            variant="primary"
            onClick={() => { setShowNew(true); setNewNummer(teams.length + 1); }}
          >
            + Neues Team
          </Button>
        )}
      </TopBar>

      {fehler && (
        <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-[10px] border border-[var(--hot-border)] bg-hot-dim/50 px-3.5 py-2.5 text-[13px] text-ink-2 sm:mx-[22px]">
          <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-hot-tint" />
          <span>{fehler}</span>
        </div>
      )}

      {hinweis && (
        <div className="mx-4 mt-4 rounded-[10px] border border-line bg-sunken px-3.5 py-2.5 text-[13px] text-ink-2 sm:mx-[22px]">
          {hinweis}
        </div>
      )}

      {teams.length === 0 ? (
        <div className="px-[22px] py-12 text-center text-sm text-ink-3">
          Noch keine Teams angelegt
        </div>
      ) : (
        <>
          {/* Tabellenkopf (ab lg) */}
          <div
            className="hidden border-b border-line bg-sunken px-[22px] py-[11px] lg:grid"
            style={{ gridTemplateColumns: GRID_COLS, gap: "14px" }}
          >
            <span className="cg-label tracking-[0.1em]">#</span>
            <span className="cg-label tracking-[0.1em]">Team</span>
            <span className="cg-label tracking-[0.1em]">Captain</span>
            <span className="cg-label text-right tracking-[0.1em]">Teilnehmer</span>
            <span className="cg-label tracking-[0.1em]">Motto</span>
            <span className="cg-label tracking-[0.1em]">Farbe</span>
            <span className="cg-label tracking-[0.1em]" aria-hidden />
          </div>

          {/* Zeilen / Karten */}
          <div className="max-lg:space-y-3 max-lg:p-4">
            {teams.map(t => (
              <div
                key={t.id}
                className="transition-colors duration-150 hover:bg-sunken/60 max-lg:rounded-[10px] max-lg:border max-lg:border-line max-lg:bg-surface lg:border-b lg:border-line-soft"
              >
                {/* Desktop-Zeile */}
                <div
                  className="hidden h-[62px] items-center px-[22px] lg:grid"
                  style={{ gridTemplateColumns: GRID_COLS, gap: "14px" }}
                >
                  <span className="tnum text-xs font-semibold text-ink-3">{t.nummer}</span>
                  <Link
                    href={`/admin/teams/${t.id}`}
                    className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:text-action"
                  >
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: t.farbe }}
                    />
                    <span className="truncate">{t.name}</span>
                  </Link>
                  <span className="truncate text-xs text-ink-3">{t.captainName ?? "–"}</span>
                  <span className="tnum text-right text-xs text-ink-3">
                    {t.teilnehmerAnzahl ?? "–"}
                  </span>
                  <span className="truncate text-xs text-ink-3">{t.motto ?? "–"}</span>
                  <span
                    className="h-5 w-5 rounded-[5px] border border-line"
                    style={{ backgroundColor: t.farbe }}
                  />
                  <span className="text-right">
                    <button
                      onClick={() => deleteTeam(t)}
                      className="rounded-[7px] border border-[var(--hot-border)] px-2.5 py-1 text-[11px] font-medium text-hot-tint transition-colors duration-150 hover:bg-hot-dim"
                    >
                      Löschen
                    </button>
                  </span>
                </div>

                {/* Mobile-Karte */}
                <div className="flex flex-col gap-2.5 p-4 lg:hidden">
                  <div className="flex items-center gap-2.5">
                    <span className="tnum text-xs font-semibold text-ink-3">{t.nummer}</span>
                    <Link
                      href={`/admin/teams/${t.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-ink"
                    >
                      <span
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ backgroundColor: t.farbe }}
                      />
                      <span className="truncate">{t.name}</span>
                    </Link>
                    <span
                      className="h-5 w-5 flex-none rounded-[5px] border border-line"
                      style={{ backgroundColor: t.farbe }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-3">
                    <span>{t.captainName ?? "Kein Captain"}</span>
                    <span className="tnum">{t.teilnehmerAnzahl ?? "–"} Teilnehmer</span>
                  </div>
                  {t.motto && (
                    <p className="truncate text-[11px] text-ink-3">{t.motto}</p>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => deleteTeam(t)}
                      className="rounded-[7px] border border-[var(--hot-border)] px-2.5 py-1 text-[11px] font-medium text-hot-tint transition-colors duration-150 hover:bg-hot-dim"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
