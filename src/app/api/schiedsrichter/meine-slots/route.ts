import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { getCurrentZeitplanConfig } from "@/lib/zeitplan-config";
import { getFeldNummern } from "@/lib/feld-info";

// GET /api/schiedsrichter/meine-slots – Persönlicher Tagesplan des eingeloggten Schiedsrichters
export async function GET() {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;
  const userId = session!.user.id;

  try {
    const config = await getCurrentZeitplanConfig();
    if (!config) return NextResponse.json({ config: null, slots: [] });

    const slots = await prisma.zeitplanSlot.findMany({
      where: {
        configId: config.id,
        gameId: { not: null },
        OR: [
          { personen: { some: { personId: userId } } },
          // Fallback: alte Direkt-Zuweisung über schiedsrichterId
          { schiedsrichterId: userId },
        ],
      },
      include: {
        game: {
          select: { id: true, name: true, slug: true, modus: true, teamsProSlot: true },
        },
        teams: {
          include: { team: { select: { id: true, name: true, nummer: true, farbe: true } } },
        },
        // Laufende Ergebnisse mitliefern, damit ein AKTIV-Slot direkt in die
        // Live-Erfassung springen kann (ergebnisIds gehen sonst verloren)
        ergebnisse: {
          where: { status: "LAUFEND" },
          select: { id: true },
        },
      },
      orderBy: [{ startZeit: "asc" }, { runde: "asc" }],
    });

    const gameIds = slots
      .map((s) => s.game?.id)
      .filter((id): id is string => Boolean(id));
    const feldNummern = await getFeldNummern(gameIds);

    return NextResponse.json({
      config: { id: config.id, name: config.name, istAktiv: config.istAktiv },
      slots: slots.map((s) => ({
        slotId: s.id,
        status: s.status,
        runde: s.runde,
        startZeit: s.startZeit,
        endZeit: s.endZeit,
        gameId: s.game?.id ?? "",
        gameName: s.game?.name ?? "–",
        gameSlug: s.game?.slug ?? "",
        gameModus: s.game?.modus ?? "SOLO",
        teamsProSlot: s.game?.teamsProSlot ?? 1,
        teamIds: s.teams.map((t) => t.team.id),
        teamNames: s.teams.map((t) => t.team.name),
        ergebnisIds: s.ergebnisse.map((e) => e.id),
        feld: s.game ? (feldNummern.get(s.game.id) ?? null) : null,
      })),
    });
  } catch (error) {
    console.error("GET /api/schiedsrichter/meine-slots error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Einsätze" },
      { status: 500 }
    );
  }
}
