import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { updateGameRaenge } from "@/lib/game-punkte";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

/**
 * POST /api/gameday/reset — löscht Test-Ergebnisse und öffnet den Zeitplan
 * für einen weiteren Probelauf.
 *
 * ORGA statt ADMIN: Der Leitstand ist ab ORGA erreichbar, und der Reset ist
 * die einzige Möglichkeit, zwischen zwei Probeläufen wieder bei null zu
 * starten. Mit ADMIN-Pflicht stünde die Generalprobe still, sobald kein Admin
 * am Gerät ist. Gegen Datenverlust schützt weiterhin die HOT-Sperre unten —
 * im produktiven Gameday ist der Reset komplett gesperrt.
 */
export async function POST() {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    // Löschen von Test-Ergebnissen ist im TEST-Modus sowie bei INAKTIV erlaubt
    // (z.B. um Alt-Testdaten vor dem HOT-Start zu bereinigen). Im HOT-Modus gesperrt.
    const config = await prisma.gamedayConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (config && config.modus === "HOT") {
      return NextResponse.json(
        { error: "Reset im HOT-Modus nicht möglich" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const testErgebnisse = await tx.ergebnis.findMany({
        where: { istTest: true },
        select: { id: true, gameId: true },
      });

      const testIds = testErgebnisse.map((e) => e.id);
      const gameIds = [...new Set(testErgebnisse.map((e) => e.gameId))];

      let deletedHistory = 0;
      let deletedErgebnisse = 0;

      if (testIds.length > 0) {
        const historyResult = await tx.ergebnisHistory.deleteMany({
          where: { ergebnisId: { in: testIds } },
        });
        deletedHistory = historyResult.count;

        const ergebnisResult = await tx.ergebnis.deleteMany({
          where: { istTest: true },
        });
        deletedErgebnisse = ergebnisResult.count;

        // Ränge der betroffenen Games neu berechnen (falls echte Ergebnisse übrig sind)
        const games = await tx.game.findMany({
          where: { id: { in: gameIds } },
          select: { id: true, wertungslogik: true },
        });
        for (const game of games) {
          await updateGameRaenge(game.id, game.wertungslogik as Wertungslogik | null, tx);
        }
      }

      // Slot-Status zurücksetzen (AKTIV/ABGESCHLOSSEN → GEPLANT), damit ein
      // zweiter Probelauf ohne Zeitplan-Neuaufbau möglich ist. Einsatzplan-
      // Zuweisungen (schiedsrichterId, Personen) bleiben unangetastet.
      //
      // Bewusst OHNE Filter auf den aktiven Zeitplan: Die Schiedsrichter-
      // Endpoints lösen den Plan über getCurrentZeitplanConfig() auf, das auf
      // den zuletzt erstellten Plan zurückfällt, wenn keiner istAktiv gesetzt
      // hat. Ein Filter auf istAktiv würde also genau die Slots stehen lassen,
      // an denen die Schiedsrichter gerade gearbeitet haben. Der Reset läuft
      // ohnehin nur ausserhalb des HOT-Modus.
      const slotsResult = await tx.zeitplanSlot.updateMany({
        where: { status: { not: "GEPLANT" } },
        data: { status: "GEPLANT" },
      });

      return { deletedHistory, deletedErgebnisse, resetSlots: slotsResult.count };
    }, {
      // Grosszügiger als die 5 s Standard: Der Reset schreibt viele Zeilen und
      // konkurriert mit laufenden Ergebnis-Transaktionen der Schiedsrichter.
      // Ein Timeout hier käme beim Schiedsrichter als "keine Verbindung" an.
      timeout: 20_000,
      maxWait: 10_000,
    });

    return NextResponse.json({
      deleted: {
        ergebnisse: result.deletedErgebnisse,
        history: result.deletedHistory,
      },
      resetSlots: result.resetSlots,
    });
  } catch (error) {
    console.error("POST /api/gameday/reset error:", error);
    return NextResponse.json(
      { error: "Fehler beim Zurücksetzen der Test-Daten" },
      { status: 500 },
    );
  }
}
