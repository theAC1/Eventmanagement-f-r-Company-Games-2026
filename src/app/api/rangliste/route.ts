/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berechneGesamtrangliste } from "@/lib/rangpunkte";

// GET /api/rangliste – Live-Gesamtrangliste
export async function GET() {
  try {
    const [ergebnisse, teams, games] = await Promise.all([
      prisma.ergebnis.findMany({
        where: { gamePunkte: { not: null }, rangImGame: { not: null } },
        select: {
          id: true,
          gameId: true,
          teamId: true,
          gamePunkte: true,
          rangImGame: true,
          rangPunkte: true,
        },
      }),
      prisma.team.findMany({
        select: { id: true, name: true, nummer: true },
        orderBy: { nummer: "asc" },
      }),
      prisma.game.findMany({
        where: { status: { in: ["BEREIT", "AKTIV"] } },
        select: { id: true },
      }),
    ]);

    const raenge = ergebnisse.map((e: any) => ({
      teamId: e.teamId,
      gameId: e.gameId,
      ergebnisId: e.id,
      gamePunkte: e.gamePunkte ?? 0,
      rangImGame: e.rangImGame ?? 0,
      rangPunkte: e.rangPunkte ?? 0,
    }));

    const rangliste = berechneGesamtrangliste(raenge, teams, games.length);

    return NextResponse.json({
      rangliste,
      totalGames: games.length,
      totalTeams: teams.length,
      ergebnisseEingetragen: ergebnisse.length,
    });
  } catch (error) {
    console.error("GET /api/rangliste error:", error);
    return NextResponse.json({ error: "Fehler beim Berechnen" }, { status: 500 });
  }
}
