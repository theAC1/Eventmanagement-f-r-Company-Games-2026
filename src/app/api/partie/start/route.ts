import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// POST /api/partie/start
export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
    const body = await request.json();
    const { gameId, teamIds, zeitplanSlotId } = body as {
      gameId: string;
      teamIds: string[];
      zeitplanSlotId?: string;
    };

    if (!gameId || !Array.isArray(teamIds) || teamIds.length === 0) {
      return NextResponse.json(
        { error: "gameId und mindestens ein teamId sind erforderlich" },
        { status: 400 },
      );
    }

    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });

    if (!gamedayConfig) {
      return NextResponse.json(
        { error: "Kein aktiver Gameday — Partien können nur während eines aktiven Gamedays gestartet werden" },
        { status: 400 },
      );
    }

    const istTest = gamedayConfig.modus === "TEST";
    const userId = session?.user?.id ?? null;

    const ergebnisse = await prisma.$transaction(async (tx) => {
      const results = await Promise.all(
        teamIds.map((teamId) =>
          tx.ergebnis.upsert({
            where: { gameId_teamId: { gameId, teamId } },
            create: {
              gameId,
              teamId,
              zeitplanSlotId: zeitplanSlotId ?? null,
              rohdaten: {},
              gamePunkte: null,
              status: "LAUFEND",
              eingetragenVonId: userId,
              eingetragenUm: new Date(),
              istTest,
            },
            update: {
              status: "LAUFEND",
              rohdaten: {},
              zeitplanSlotId: zeitplanSlotId ?? null,
              eingetragenVonId: userId,
              eingetragenUm: new Date(),
              istTest,
            },
          }),
        ),
      );

      if (zeitplanSlotId) {
        await tx.zeitplanSlot.update({
          where: { id: zeitplanSlotId },
          data: { status: "AKTIV" },
        });
      }

      return results;
    });

    return NextResponse.json(ergebnisse, { status: 201 });
  } catch (error) {
    console.error("POST /api/partie/start error:", error);
    return NextResponse.json(
      { error: "Fehler beim Starten der Partie" },
      { status: 500 },
    );
  }
}
