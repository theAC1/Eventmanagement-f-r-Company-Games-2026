/**
 * Rangpunkte-Berechnung für Company Games 2026
 */

type ErgebnisInput = {
  id: string;
  gameId: string;
  teamId: string;
  gamePunkte: number | null;
  rohdaten: Record<string, unknown>;
};

type RangResult = {
  teamId: string;
  gameId: string;
  ergebnisId: string;
  gamePunkte: number;
  rangImGame: number;
  rangPunkte: number;
};

type GesamtRang = {
  teamId: string;
  teamName: string;
  rangPunkteSumme: number;
  gamesGespielt: number;
  gamesTotal: number;
  platzierungen: Record<number, number>;
  gesamtRang: number;
};

type WertungslogikConfig = {
  richtung?: string;
};

export function berechneGameRang(
  ergebnisse: ErgebnisInput[],
  wertungslogik: WertungslogikConfig | null,
): RangResult[] {
  if (ergebnisse.length === 0) return [];

  const richtung = wertungslogik?.richtung ?? "hoechster_gewinnt";
  const sortiert = [...ergebnisse]
    .filter((e) => e.gamePunkte !== null)
    .sort((a, b) => {
      if (richtung === "niedrigster_gewinnt") {
        return (a.gamePunkte ?? 0) - (b.gamePunkte ?? 0);
      }
      return (b.gamePunkte ?? 0) - (a.gamePunkte ?? 0);
    });

  let currentRang = 1;
  return sortiert.map((e, idx) => {
    if (idx > 0 && e.gamePunkte !== sortiert[idx - 1].gamePunkte) {
      currentRang = idx + 1;
    }
    return {
      teamId: e.teamId,
      gameId: e.gameId,
      ergebnisId: e.id,
      gamePunkte: e.gamePunkte ?? 0,
      rangImGame: currentRang,
      rangPunkte: currentRang,
    };
  });
}

export function berechneGesamtrangliste(
  alleRaenge: RangResult[],
  teams: { id: string; name: string }[],
  totalGames: number,
): GesamtRang[] {
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  const teamStats = new Map<
    string,
    { summe: number; games: number; platzierungen: Record<number, number> }
  >();

  for (const r of alleRaenge) {
    const stats = teamStats.get(r.teamId) ?? {
      summe: 0,
      games: 0,
      platzierungen: {},
    };
    stats.summe += r.rangPunkte;
    stats.games += 1;
    stats.platzierungen[r.rangImGame] =
      (stats.platzierungen[r.rangImGame] ?? 0) + 1;
    teamStats.set(r.teamId, stats);
  }

  const rangliste: GesamtRang[] = [];
  for (const [teamId, stats] of teamStats) {
    rangliste.push({
      teamId,
      teamName: teamMap.get(teamId) ?? teamId,
      rangPunkteSumme: stats.summe,
      gamesGespielt: stats.games,
      gamesTotal: totalGames,
      platzierungen: stats.platzierungen,
      gesamtRang: 0,
    });
  }

  rangliste.sort((a, b) => {
    if (a.rangPunkteSumme !== b.rangPunkteSumme) {
      return a.rangPunkteSumme - b.rangPunkteSumme;
    }
    const maxRang = Math.max(
      ...Object.keys(a.platzierungen).map(Number),
      ...Object.keys(b.platzierungen).map(Number),
      1,
    );
    for (let r = 1; r <= maxRang; r++) {
      const aCount = a.platzierungen[r] ?? 0;
      const bCount = b.platzierungen[r] ?? 0;
      if (aCount !== bCount) return bCount - aCount;
    }
    return 0;
  });

  let currentRang = 1;
  rangliste.forEach((r, idx) => {
    if (idx > 0) {
      const prev = rangliste[idx - 1];
      const isTied =
        r.rangPunkteSumme === prev.rangPunkteSumme &&
        JSON.stringify(r.platzierungen) === JSON.stringify(prev.platzierungen);
      if (!isTied) currentRang = idx + 1;
    }
    r.gesamtRang = currentRang;
  });

  return rangliste;
}
