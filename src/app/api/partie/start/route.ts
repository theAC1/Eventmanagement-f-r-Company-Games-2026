/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// POST /api/partie/start – Partie starten (Schiedsrichter nach QR-Scan)
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

    const userId = (session as any)?.user?.id ?? null;

    // Fuer jedes Team ein Ergebnis mit Status LAUFEND erstellen/aktualisieren
    const ergebnisse = await Promise.all(
      teamIds.map((teamId) =>
        prisma.ergebnis.upsert({
          where: {
            gameId_teamId: { gameId, teamId },
          },
          create: {
            gameId,
            teamId,
            zeitplanSlotId: zeitplanSlotId ?? null,
            rohdaten: {},
            gamePunkte: null,
            status: "LAUFEND",
            eingetragenVonId: userId,
            eingetragenUm: new Date(),
          },
          update: {
            status: "LAUFEND",
            rohdaten: {},
            zeitplanSlotId: zeitplanSlotId ?? null,
            eingetragenVonId: userId,
            eingetragenUm: new Date(),
          },
        }),
      ),
    );

    // ZeitplanSlot auf AKTIV setzen
    if (zeitplanSlotId) {
      await prisma.zeitplanSlot.update({
        where: { id: zeitplanSlotId },
        data: { status: "AKTIV" },
      });
    }

    return NextResponse.json(ergebnisse, { status: 201 });
  } catch (error) {
    console.error("POST /api/partie/start error:", error);
    return NextResponse.json(
      { error: "Fehler beim Starten der Partie" },
      { status: 500 },
    );
  }
}
