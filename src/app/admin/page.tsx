"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info, MagnifyingGlass } from "@phosphor-icons/react";
import { TopBar, TopBarSpacer } from "@/components/ui/top-bar";
import { KpiBand, KpiCell } from "@/components/ui/kpi";
import { ModusChip, StatusPill, type PillTone } from "@/components/ui/pills";
import { ButtonLink } from "@/components/ui/button";

type Game = {
  id: string;
  name: string;
  slug: string;
  typ: "RETURNEE" | "NEU";
  status: "ENTWURF" | "BEREIT" | "AKTIV" | "ABGESCHLOSSEN";
  modus: "SOLO" | "DUELL";
  teamsProSlot: number;
  kurzbeschreibung: string | null;
  playtimeMin: number;
  helferAnzahl: number;
  flaecheLaengeM: number | null;
  flaecheBreiteM: number | null;
  stromNoetig: boolean;
  regeln: string | null;
  wertungstyp: string | null;
  wertungslogik: Record<string, unknown> | null;
  _count: { varianten: number; materialItems: number };
};

const STATUS_TONES: Record<Game["status"], PillTone> = {
  ENTWURF: "neutral",
  BEREIT: "warn",
  AKTIV: "done",
  ABGESCHLOSSEN: "neutral",
};

const STATUS_LABELS: Record<Game["status"], string> = {
  ENTWURF: "Entwurf",
  BEREIT: "Bereit",
  AKTIV: "Aktiv",
  ABGESCHLOSSEN: "Abgeschlossen",
};

const WERTUNG_LABELS: Record<string, string> = {
  punkte: "Punkte",
  zeit: "Zeit",
  tore: "Tore",
  runden: "Runden",
  max: "Max-Wert",
  maxwert: "Max-Wert",
  hoehe: "Höhe",
  laenge: "Länge",
  distanz: "Distanz",
  gewicht: "Gewicht",
  formel: "Formel",
  multilevel: "Multi-Level",
};

/** Wertungstyp aus wertungslogik.typ (Fallback: wertungstyp) lesbar machen. */
function wertungLabel(game: Game): string {
  const logikTyp = game.wertungslogik?.typ;
  const typ =
    (typeof logikTyp === "string" && logikTyp) || game.wertungstyp || null;
  if (!typ) return "–";
  const key = typ.toLowerCase().replace(/[^a-z]/g, "");
  return WERTUNG_LABELS[key] ?? typ.charAt(0).toUpperCase() + typ.slice(1);
}

/**
 * Bereitschafts-Kriterien (nur aus real vorhandenen Feldern):
 * Regeln erfasst · Material erfasst · Helfer gesetzt · Fläche gesetzt.
 */
function readinessChecks(game: Game): boolean[] {
  return [
    Boolean(game.regeln && game.regeln.trim().length > 0),
    game._count.materialItems > 0,
    game.helferAnzahl > 0,
    Boolean(game.flaecheLaengeM && game.flaecheBreiteM),
  ];
}

function flaecheLabel(game: Game): string {
  return game.flaecheLaengeM && game.flaecheBreiteM
    ? `${game.flaecheLaengeM}×${game.flaecheBreiteM} m`
    : "–";
}

const GRID_COLS = "34px 1fr 96px 128px 74px 96px 70px 150px 116px";

function ReadinessBar({ checks }: { checks: boolean[] }) {
  const done = checks.filter(Boolean).length;
  return (
    <div className="flex items-center gap-[5px]">
      {checks.map((on, i) => (
        <span
          key={i}
          className={`h-1.5 w-[26px] rounded-full ${on ? "bg-done" : "bg-line-key"}`}
        />
      ))}
      <span className="tnum ml-1 text-[11px] text-label">{done}/4</span>
    </div>
  );
}

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/games")
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden");
        return res.json();
      })
      .then(setGames)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const numbered = useMemo(
    () => games.map((game, index) => ({ game, nr: index + 1 })),
    [games]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbered;
    return numbered.filter(
      ({ game }) =>
        game.name.toLowerCase().includes(q) ||
        (game.kurzbeschreibung ?? "").toLowerCase().includes(q)
    );
  }, [numbered, search]);

  const stats = useMemo(() => {
    const solo = games.filter((g) => g.modus === "SOLO").length;
    const bereit = games.filter(
      (g) => g.status === "BEREIT" || g.status === "AKTIV"
    ).length;
    const helferTotal = games.reduce((sum, g) => sum + g.helferAnzahl, 0);
    const flaecheTotal = games.reduce(
      (sum, g) =>
        sum +
        (g.flaecheLaengeM && g.flaecheBreiteM
          ? g.flaecheLaengeM * g.flaecheBreiteM
          : 0),
      0
    );
    const strom = games.filter((g) => g.stromNoetig).length;
    return {
      total: games.length,
      solo,
      duell: games.length - solo,
      bereit,
      helferTotal,
      flaecheTotal,
      strom,
    };
  }, [games]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Lade Games...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-hot-tint">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Games">
        <span className="text-xs text-ink-3">
          <span className="tnum">{stats.total}</span> Disziplinen ·{" "}
          <span className="tnum">{stats.solo}</span> Solo,{" "}
          <span className="tnum">{stats.duell}</span> Duell
        </span>
        <TopBarSpacer />
        <label className="relative">
          <MagnifyingGlass
            size={14}
            weight="bold"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Game suchen"
            className="h-[34px] w-[160px] rounded-[9px] border border-line-strong bg-transparent pl-8 pr-3 text-[13px] text-ink outline-none transition-colors duration-150 placeholder:text-label focus:border-action sm:w-[200px]"
          />
        </label>
        <ButtonLink href="/admin/games/new" variant="primary">
          + Neues Game
        </ButtonLink>
      </TopBar>

      <KpiBand className="max-lg:hidden">
        <KpiCell
          label="Bereit für den Tag"
          value={stats.bereit}
          denominator={`/${stats.total}`}
        />
        <KpiCell label="Helfer total" value={stats.helferTotal} unit="Personen" />
        <KpiCell
          label="Fläche belegt"
          value={stats.flaecheTotal.toLocaleString("de-CH")}
          unit="m²"
        />
        <KpiCell
          label="Strom nötig"
          value={stats.strom}
          unit={stats.strom === 1 ? "Station" : "Stationen"}
          valueColor={stats.strom > 0 ? "var(--warn)" : "var(--ink)"}
          last
        />
      </KpiBand>

      {/* Tabellenkopf (ab lg) */}
      <div
        className="hidden border-b border-line bg-sunken px-[22px] py-[11px] lg:grid"
        style={{ gridTemplateColumns: GRID_COLS, gap: "14px" }}
      >
        <span className="cg-label tracking-[0.1em]">NR</span>
        <span className="cg-label tracking-[0.1em]">Game</span>
        <span className="cg-label tracking-[0.1em]">Modus</span>
        <span className="cg-label tracking-[0.1em]">Wertung</span>
        <span className="cg-label text-right tracking-[0.1em]">Zeit</span>
        <span className="cg-label text-right tracking-[0.1em]">Fläche</span>
        <span className="cg-label text-right tracking-[0.1em]">Helfer</span>
        <span className="cg-label tracking-[0.1em]">Bereitschaft</span>
        <span className="cg-label tracking-[0.1em]">Status</span>
      </div>

      {/* Zeilen */}
      <div className="max-lg:space-y-3 max-lg:p-4">
        {filtered.length === 0 && (
          <div className="px-[22px] py-10 text-center text-sm text-ink-3">
            Keine Games gefunden.
          </div>
        )}
        {filtered.map(({ game, nr }) => {
          const checks = readinessChecks(game);
          return (
            <Link
              key={game.id}
              href={`/admin/games/${game.id}`}
              className="block transition-colors duration-150 hover:bg-sunken/60 max-lg:rounded-[10px] max-lg:border max-lg:border-line max-lg:bg-surface lg:border-b lg:border-line-soft"
            >
              {/* Desktop-Zeile */}
              <div
                className="hidden h-[62px] items-center px-[22px] lg:grid"
                style={{ gridTemplateColumns: GRID_COLS, gap: "14px" }}
              >
                <span className="tnum text-xs font-semibold text-ink-3">
                  {nr}
                </span>
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-sm font-medium text-ink">
                    {game.name}
                  </span>
                  <span className="truncate text-[11px] text-ink-3">
                    {game.kurzbeschreibung ?? "–"}
                  </span>
                </div>
                <ModusChip modus={game.modus} className="justify-self-start" />
                <span className="truncate text-xs text-ink-3">
                  {wertungLabel(game)}
                </span>
                <span className="tnum text-right text-xs text-ink-3">
                  {game.playtimeMin} min
                </span>
                <span className="tnum text-right text-xs text-ink-3">
                  {flaecheLabel(game)}
                </span>
                <span className="tnum text-right text-xs text-ink-3">
                  {game.helferAnzahl}
                </span>
                <ReadinessBar checks={checks} />
                <StatusPill
                  tone={STATUS_TONES[game.status]}
                  className="justify-self-start"
                >
                  {STATUS_LABELS[game.status]}
                </StatusPill>
              </div>

              {/* Mobile-Karte */}
              <div className="flex flex-col gap-2.5 p-4 lg:hidden">
                <div className="flex items-center gap-2.5">
                  <span className="tnum text-xs font-semibold text-ink-3">
                    {nr}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {game.name}
                  </span>
                  <StatusPill tone={STATUS_TONES[game.status]}>
                    {STATUS_LABELS[game.status]}
                  </StatusPill>
                </div>
                {game.kurzbeschreibung && (
                  <p className="text-[11px] leading-snug text-ink-3">
                    {game.kurzbeschreibung}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-3">
                  <ModusChip modus={game.modus} />
                  <span>{wertungLabel(game)}</span>
                  <span className="tnum">{game.playtimeMin} min</span>
                  <span className="tnum">{flaecheLabel(game)}</span>
                  <span className="tnum">{game.helferAnzahl} Helfer</span>
                </div>
                <ReadinessBar checks={checks} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Fussnote */}
      <div className="flex items-center gap-2.5 px-[22px] py-3 text-xs text-faint max-lg:px-4">
        <Info size={14} weight="bold" />
        <span>Balken = Regeln · Material · Helfer · Fläche geklärt</span>
      </div>
    </div>
  );
}
