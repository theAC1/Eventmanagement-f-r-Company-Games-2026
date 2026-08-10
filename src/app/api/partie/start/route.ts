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
      const bestehende = await tx.ergebnis.findMany({
        where: { gameId, teamId: { in: teamIds } },
      });
      const bestehendeProTeam = new Map(bestehende.map((e) => [e.teamId, e]));

      const results: typeof bestehende = [];
      for (const teamId of teamIds) {
        const vorhanden = bestehendeProTeam.get(teamId);

        // Echte Ergebnisse (EINGETRAGEN/VERIFIZIERT/KORRIGIERT) überlebt ein
        // Partie-Neustart unverändert — nur Platzhalter werden aufgefrischt
        if (vorhanden && vorhanden.status !== "LAUFEND" && vorhanden.status !== "AUSSTEHEND") {
          results.push(vorhanden);
          continue;
        }

        results.push(
          await tx.ergebnis.upsert({
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
              gamePunkte: null,
              zeitplanSlotId: zeitplanSlotId ?? null,
              eingetragenVonId: userId,
              eingetragenUm: new Date(),
              istTest,
            },
          }),
        );
      }

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
