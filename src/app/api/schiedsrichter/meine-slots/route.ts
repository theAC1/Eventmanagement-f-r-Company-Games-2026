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
          // Feinjustierung für einzelne Runden — schlägt die Posten-Crew.
          { personen: { some: { personId: userId } } },
          // Fallback: alte Direkt-Zuweisung über schiedsrichterId
          { schiedsrichterId: userId },
          // Posten-Crew — der REGULÄRE Weg: Die Orga teilt im Games-Tab pro
          // Posten ein (GameCrew), nicht Slot für Slot; genau daraus leitet
          // auch /api/einsatzplan seine Besetzung ab. Ohne diese Bedingung
          // blieb der Tagesplan jedes so eingeteilten Schiedsrichters leer,
          // obwohl der Einsatzplan im Leitstand korrekt aussah.
          //
          // Nur für Slots OHNE eigene Personen-Zuweisung: Ist eine Runde
          // ausdrücklich jemandem zugeteilt, gilt diese Zuteilung — sonst
          // stünde die Runde bei der ganzen Posten-Crew im Tagesplan.
          {
            AND: [
              { personen: { none: {} } },
              { game: { crew: { some: { personId: userId } } } },
            ],
          },
        ],
      },
      include: {
        game: {
          select: { id: true, name: true, slug: true, modus: true, teamsProSlot: true },
        },
        teams: {
          include: { team: { select: { id: true, name: true, nummer: true, farbe: true } } },
        },
        // Ergebnisse eines noch offenen Slots mitliefern, damit die
        // Live-Erfassung sie wiederfindet.
        //
        // Bewusst nicht nur LAUFEND: Sobald der Schiedsrichter gespeichert
        // hat, steht das Ergebnis auf EINGETRAGEN/KORRIGIERT, während der Slot
        // weiter AKTIV ist. Mit dem alten Filter kam der Slot dann ohne
        // ergebnisIds zurück, die Live-Seite lud nichts mehr und der
        // Schiedsrichter landete auf einem leeren Bildschirm ohne Rückweg.
        ergebnisse: {
          where: { status: { in: ["LAUFEND", "EINGETRAGEN", "KORRIGIERT"] } },
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
