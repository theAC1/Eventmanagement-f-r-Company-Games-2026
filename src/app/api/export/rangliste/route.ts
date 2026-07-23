/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { berechneGesamtrangliste } from "@/lib/rangpunkte";
import { generateRanglisteCSV } from "@/lib/export";

export async function GET() {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const [ergebnisse, teams, games] = await Promise.all([
      prisma.ergebnis.findMany({
        where: { gamePunkte: { not: null }, rangImGame: { not: null } },
        select: {
          id: true, gameId: true, teamId: true,
          gamePunkte: true, rangImGame: true, rangPunkte: true,
        },
        take: 10000,
      }),
      prisma.team.findMany({
        select: { id: true, name: true, nummer: true },
        orderBy: { nummer: "asc" },
        take: 1000,
      }),
      prisma.game.findMany({
        where: { status: { in: ["BEREIT", "AKTIV"] } },
        select: { id: true },
        take: 200,
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

    // Team-Nummern hinzufügen
    const teamNummerMap = new Map(teams.map((t) => [t.id, t.nummer]));
    const ranglisteWithNummer = rangliste.map((r) => ({
      ...r,
      teamNummer: teamNummerMap.get(r.teamId),
    }));

    const csv = generateRanglisteCSV(ranglisteWithNummer, {
      totalGames: games.length,
      totalTeams: teams.length,
      ergebnisseEingetragen: ergebnisse.length,
    });

    const datum = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rangliste-${datum}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/rangliste error:", error);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
