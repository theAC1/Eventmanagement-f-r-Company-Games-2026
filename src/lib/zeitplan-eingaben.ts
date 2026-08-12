/**
 * Stammdaten, die die Zeitplan-Engine braucht — an einer Stelle geladen.
 *
 * Preview (`/api/schedule/generate`) und Speichern arbeiten mit demselben
 * Stand; läge das Laden in beiden Routen, würden sie mit der Zeit auseinander
 * laufen.
 */

import { prisma } from "@/lib/prisma";
import type { GameInput, TeamInput } from "@/lib/schedule-engine";
import type { AktuellerStand } from "@/lib/zeitplan-aktualitaet";

export type ZeitplanEingaben = {
  teams: TeamInput[];
  games: GameInput[];
  freieHelfer: { id: string; name: string }[];
};

/** Games, die in einen Zeitplan gehören. Alles andere ist Entwurf. */
export const ZEITPLAN_GAME_STATUS = ["BEREIT", "AKTIV"] as const;

/**
 * Kopfzahl der Posten-Crew für die Verpflegung: bereits zugeteilte Personen,
 * solange noch niemand zugeteilt ist ersatzweise die geplante Sollstärke.
 */
function crewGroesse(game: {
  _count: { crew: number };
  schiedsrichterAnzahl: number;
  helferAnzahl: number;
}): number {
  return game._count.crew > 0
    ? game._count.crew
    : game.schiedsrichterAnzahl + game.helferAnzahl;
}

export async function ladeZeitplanEingaben(): Promise<ZeitplanEingaben> {
  const [games, teams, helfer] = await Promise.all([
    prisma.game.findMany({
      where: { status: { in: [...ZEITPLAN_GAME_STATUS] } },
      select: {
        id: true,
        name: true,
        teamsProSlot: true,
        durchgaenge: true,
        schiedsrichterAnzahl: true,
        helferAnzahl: true,
        _count: { select: { crew: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      select: { id: true, name: true, nummer: true, teilnehmerAnzahl: true },
      orderBy: { nummer: "asc" },
    }),
    // Helfer und Schiedsrichter ohne Posten essen mit, wenn sie es gemeldet
    // haben — sie brauchen eine eigene Welle.
    prisma.person.findMany({
      where: {
        istAktiv: true,
        isstMittag: true,
        rolle: { in: ["SCHIEDSRICHTER", "HELFER", "ORGA"] },
        postenCrew: { none: {} },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    teams,
    games: games.map((g) => ({
      id: g.id,
      name: g.name,
      teamsProSlot: g.teamsProSlot,
      durchgaenge: g.durchgaenge,
      crewGroesse: crewGroesse(g),
    })),
    freieHelfer: helfer,
  };
}

/** Soll-Durchgänge je Game-ID — Grundlage der Konflikt-Prüfung. */
export async function ladeSollDurchgaenge(): Promise<Record<string, number>> {
  const games = await prisma.game.findMany({
    select: { id: true, durchgaenge: true },
  });
  return Object.fromEntries(games.map((g) => [g.id, g.durchgaenge]));
}

/** Heutiger Stammdaten-Stand — Vergleichsbasis für die Zeitplan-Aktualität. */
export async function ladeAktuellenStand(): Promise<AktuellerStand> {
  const [teams, games] = await Promise.all([
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { nummer: "asc" },
    }),
    prisma.game.findMany({
      where: { status: { in: [...ZEITPLAN_GAME_STATUS] } },
      select: { id: true, name: true, durchgaenge: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { teams, games };
}
