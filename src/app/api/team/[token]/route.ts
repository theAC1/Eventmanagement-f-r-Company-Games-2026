import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berechneGesamtrangliste } from "@/lib/rangpunkte";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  try {
    const team = await prisma.team.findUnique({
      where: { qrToken: token },
      select: { id: true, name: true, nummer: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    const [teamErgebnisse, ergebnisse, teams, games] = await Promise.all([
      prisma.ergebnis.findMany({
        where: {
          teamId: team.id,
          gamePunkte: { not: null },
          rangImGame: { not: null },
        },
        select: {
          id: true,
          gamePunkte: true,
          rangImGame: true,
          rangPunkte: true,
          status: true,
          game: { select: { name: true } },
        },
        orderBy: { game: { name: "asc" } },
      }),
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

    const raenge = ergebnisse.map((e) => ({
      teamId: e.teamId,
      gameId: e.gameId,
      ergebnisId: e.id,
      gamePunkte: e.gamePunkte ?? 0,
      rangImGame: e.rangImGame ?? 0,
      rangPunkte: e.rangPunkte ?? 0,
    }));

    return NextResponse.json({
      team,
      ergebnisse: teamErgebnisse,
      rangliste: berechneGesamtrangliste(raenge, teams, games.length),
    });
  } catch (error) {
    console.error(`GET /api/team/${token} error:`, error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
