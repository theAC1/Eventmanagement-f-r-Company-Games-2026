import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { updateGameRaenge } from "@/lib/game-punkte";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

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
      /** Wurde ein bereits gewertetes Ergebnis auf Platzhalter zurückgesetzt? */
      let zurueckgesetzt = false;
      for (const teamId of teamIds) {
        const vorhanden = bestehendeProTeam.get(teamId);

        // Echte Ergebnisse (EINGETRAGEN/VERIFIZIERT/KORRIGIERT) überleben einen
        // Partie-Neustart unverändert — nur Platzhalter werden aufgefrischt.
        //
        // Ausnahme Probelauf: Dort ist das Wiederholen derselben Begegnung der
        // Sinn der Übung. Würde hier das alte Ergebnis zurückkommen, stünden im
        // Live-Formular die Zahlen des letzten Durchgangs und das Speichern
        // liefe in die 10-Minuten-Sperrfrist — für den Schiedsrichter ein
        // unerklärlicher Fehler. Test-Ergebnisse löscht der Reset ohnehin.
        const istWiederholbar = istTest && vorhanden?.istTest;
        if (
          vorhanden &&
          vorhanden.status !== "LAUFEND" &&
          vorhanden.status !== "AUSSTEHEND" &&
          !istWiederholbar
        ) {
          results.push(vorhanden);
          continue;
        }

        // Ein bereits gewertetes Ergebnis wird jetzt zum Platzhalter — seine
        // Punkte fallen aus der Wertung, die Ränge müssen danach neu.
        if (vorhanden && vorhanden.gamePunkte !== null) zurueckgesetzt = true;

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

      // Wurde im Probelauf ein fertiges Ergebnis auf LAUFEND zurückgesetzt,
      // fehlen dessen Punkte jetzt in der Wertung — die Ränge der übrigen
      // Teams stimmen bis zur nächsten Eingabe nicht mehr. Deshalb hier
      // sofort neu berechnen.
      if (zurueckgesetzt) {
        const game = await tx.game.findUnique({
          where: { id: gameId },
          select: { wertungslogik: true },
        });
        await updateGameRaenge(gameId, game?.wertungslogik as Wertungslogik | null, tx);
      }

      return results;
    });

    return NextResponse.json(ergebnisse, { status: 201 });
  } catch (error) {
    // P2025 = referenzierte Zeile fehlt. Praktisch immer ein Slot aus einem
    // inzwischen neu aufgebauten Zeitplan (alter Link im Verlauf). Als
    // generischer 500er wäre das am Posten nicht zu deuten.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error:
            "Dieser Zeitplan-Slot existiert nicht mehr (der Zeitplan wurde neu aufgebaut). Bitte zurück zu «Mein Tagesplan» und den Einsatz dort neu öffnen.",
        },
        { status: 409 },
      );
    }
    console.error("POST /api/partie/start error:", error);
    return NextResponse.json(
      { error: "Fehler beim Starten der Partie" },
      { status: 500 },
    );
  }
}
