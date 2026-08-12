import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berechneGesamtrangliste } from "@/lib/rangpunkte";
import { istGesperrt } from "@/lib/ergebnis-sperre";
import type { Prisma } from "@prisma/client";

// GET /api/rangliste – Live-Gesamtrangliste
export async function GET() {
  try {
    // Aktiven Gameday-Modus bestimmen: nur im TEST-Modus fliessen Test-Ergebnisse
    // in die Rangliste ein (Probelauf-Scoreboard). In HOT/INAKTIV werden sie
    // ausgeschlossen, damit Probeläufe die echte Rangliste nicht verfälschen.
    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      orderBy: { createdAt: "desc" },
      select: { modus: true },
    });
    const modus = gamedayConfig?.modus ?? "INAKTIV";
    const includeTest = modus === "TEST";

    const ergebnisWhere: Prisma.ErgebnisWhereInput = {
      gamePunkte: { not: null },
      rangImGame: { not: null },
      // Bonus-Opt-out: Ergebnisse von Games mit zaehltZurWertung=false
      // fliessen nicht in die Gesamtwertung ein
      game: { zaehltZurWertung: true },
      ...(includeTest ? {} : { istTest: false }),
    };

    const [ergebnisse, teams, games] = await Promise.all([
      prisma.ergebnis.findMany({
        where: ergebnisWhere,
        select: {
          id: true,
          gameId: true,
          teamId: true,
          gamePunkte: true,
          rangImGame: true,
          rangPunkte: true,
          eingetragenUm: true,
        },
      }),
      prisma.team.findMany({
        select: { id: true, name: true, nummer: true },
        orderBy: { nummer: "asc" },
      }),
      prisma.game.findMany({
        // gamesTotal zählt nur Games, die zur Gesamtwertung zählen
        where: { status: { in: ["BEREIT", "AKTIV"] }, zaehltZurWertung: true },
        select: { id: true },
      }),
    ]);

    const raenge = ergebnisse.map((e) => ({
      teamId: e.teamId,
      gameId: e.gameId,
      ergebnisId: e.id,
      gamePunkte: e.gamePunkte ?? 0,
      rangImGame: e.rangImGame ?? 0,
      rangPunkte: e.rangPunkte ?? 0,
    }));

    const rangliste = berechneGesamtrangliste(raenge, teams, games.length);

    // Rang-Sperrstatus: Ergebnisse innerhalb der Korrekturfrist sind noch
    // korrigierbar — der Rang des betroffenen Teams gilt als provisorisch.
    const offeneErgebnisse = ergebnisse.filter((e) => !istGesperrt(e.eingetragenUm));
    const offeneTeamIds = new Set(offeneErgebnisse.map((e) => e.teamId));

    return NextResponse.json({
      rangliste: rangliste.map((entry) => ({
        ...entry,
        rangGesperrt: !offeneTeamIds.has(entry.teamId),
      })),
      totalGames: games.length,
      totalTeams: teams.length,
      ergebnisseEingetragen: ergebnisse.length,
      offeneKorrekturen: offeneErgebnisse.length,
      modus,
      enthaeltTestErgebnisse: includeTest,
    });
  } catch (error) {
    console.error("GET /api/rangliste error:", error);
    return NextResponse.json({ error: "Fehler beim Berechnen" }, { status: 500 });
  }
}
