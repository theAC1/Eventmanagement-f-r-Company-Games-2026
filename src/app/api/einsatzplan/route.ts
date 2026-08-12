import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { getCurrentZeitplanConfig } from "@/lib/zeitplan-config";
import type { MittagsWelle } from "@/lib/mittagsplanung";

/**
 * GET /api/einsatzplan
 *
 * Der Einsatzplan wird aus der Posten-Crew abgeleitet: zugeteilt wird im
 * Games-Tab pro Posten, nicht mehr Slot für Slot. Slot-Zuweisungen
 * (ZeitplanSlotPerson) bleiben als Feinjustierung für einzelne Runden möglich
 * und überschreiben die Posten-Crew in diesem Slot.
 */
export async function GET() {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const config = await getCurrentZeitplanConfig();
    if (!config) return NextResponse.json({ config: null, slots: [], posten: [] });

    const [slots, crew] = await Promise.all([
      prisma.zeitplanSlot.findMany({
        where: { gameId: { not: null }, configId: config.id },
        include: {
          game: {
            select: {
              id: true,
              name: true,
              slug: true,
              schiedsrichterAnzahl: true,
              helferAnzahl: true,
              durchgaenge: true,
            },
          },
          teams: { include: { team: { select: { id: true, name: true, nummer: true } } } },
          personen: { include: { person: { select: { id: true, name: true, rolle: true } } } },
          config: { select: { id: true, name: true, createdAt: true } },
        },
        orderBy: [{ runde: "asc" }, { startZeit: "asc" }],
      }),
      prisma.gameCrew.findMany({
        select: {
          gameId: true,
          rolle: true,
          person: { select: { id: true, name: true, rolle: true } },
        },
        orderBy: { person: { name: "asc" } },
      }),
    ]);

    const crewProGame = new Map<string, typeof crew>();
    for (const eintrag of crew) {
      const liste = crewProGame.get(eintrag.gameId) ?? [];
      liste.push(eintrag);
      crewProGame.set(eintrag.gameId, liste);
    }

    const wellen = (config.mittagswellen ?? []) as unknown as MittagsWelle[];
    const wellenProPosten = new Map(
      wellen.flatMap((w) => w.postenIds.map((id) => [id, w] as const)),
    );

    // Pro Posten: Besetzung, Bedarf und die Runde, in der die Crew isst.
    const posten = [...new Set(slots.map((s) => s.game!.id))].map((gameId) => {
      const game = slots.find((s) => s.game!.id === gameId)!.game!;
      const besetzung = crewProGame.get(gameId) ?? [];
      const schiedsrichter = besetzung.filter((c) => c.person.rolle === "SCHIEDSRICHTER");
      const welle = wellenProPosten.get(gameId);
      return {
        gameId,
        gameName: game.name,
        gameSlug: game.slug,
        durchgaenge: game.durchgaenge,
        slots: slots.filter((s) => s.game!.id === gameId).length,
        bedarfSchiedsrichter: game.schiedsrichterAnzahl,
        bedarfHelfer: game.helferAnzahl,
        crew: besetzung.map((c) => c.person),
        unterbesetzt: schiedsrichter.length < game.schiedsrichterAnzahl,
        mittag: welle ? { startZeit: welle.startZeit, endZeit: welle.endZeit } : null,
      };
    });
    posten.sort((a, b) => a.gameName.localeCompare(b.gameName));

    return NextResponse.json({ config, slots, posten });
  } catch (error) {
    console.error("GET /api/einsatzplan error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Einsatzplans" },
      { status: 500 }
    );
  }
}
