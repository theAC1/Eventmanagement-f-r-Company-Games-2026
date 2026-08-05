import { prisma } from "@/lib/prisma";

/**
 * Feld-Nummern der Games auf dem aktiven Situationsplan.
 * Nur öffentliche Positionen mit gesetzter Nummer — Team- und Referee-Ansichten
 * zeigen daraus "Feld {nummer}".
 */
export async function getFeldNummern(gameIds: string[]): Promise<Map<string, string>> {
  if (gameIds.length === 0) return new Map();

  const plan = await prisma.situationsplan.findFirst({
    where: { istAktiv: true },
    select: {
      gamePositionen: {
        where: { gameId: { in: gameIds }, oeffentlich: true, nummer: { not: "" } },
        select: { gameId: true, nummer: true },
      },
    },
  });

  return new Map((plan?.gamePositionen ?? []).map((p) => [p.gameId, p.nummer]));
}
