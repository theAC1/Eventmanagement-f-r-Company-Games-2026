import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { generateErgebnisseCSV } from "@/lib/export";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    const where: Record<string, unknown> = {};
    if (gameId) where.gameId = gameId;

    const ergebnisse = await prisma.ergebnis.findMany({
      where,
      include: {
        game: { select: { name: true } },
        team: { select: { name: true, nummer: true } },
      },
      orderBy: [{ game: { name: "asc" } }, { rangImGame: "asc" }],
      take: 10000,
    });

    const csv = generateErgebnisseCSV(
      ergebnisse.map((e) => ({
        gameName: e.game.name,
        teamName: e.team.name,
        teamNummer: e.team.nummer,
        gamePunkte: e.gamePunkte,
        rangImGame: e.rangImGame,
        status: e.status,
        eingetragenUm: e.eingetragenUm?.toISOString() ?? null,
      })),
    );

    const datum = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ergebnisse-${datum}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/ergebnisse error:", error);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
