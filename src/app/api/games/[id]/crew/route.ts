import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { GameCrewSchema, zodValidationError } from "@/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

const CREW_SELECT = {
  id: true,
  rolle: true,
  person: { select: { id: true, name: true, rolle: true, isstMittag: true } },
} as const;

// GET /api/games/:id/crew – Schiedsrichter und Helfer dieses Postens
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  const { id } = await params;
  try {
    const crew = await prisma.gameCrew.findMany({
      where: { gameId: id },
      select: CREW_SELECT,
      orderBy: { person: { name: "asc" } },
    });
    return NextResponse.json(crew);
  } catch (error) {
    console.error(`GET /api/games/${id}/crew error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Posten-Crew" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/games/:id/crew – Besetzung des Postens setzen (ersetzt die alte).
 *
 * Die Rolle wird aus der Person übernommen, nicht vom Client entgegengenommen:
 * ein Schiedsrichter bleibt Schiedsrichter, egal was gesendet wird.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const parsed = GameCrewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!game) {
      return NextResponse.json({ error: "Game nicht gefunden" }, { status: 404 });
    }

    const personIds = [...new Set(parsed.data.personIds)];
    const personen = await prisma.person.findMany({
      where: { id: { in: personIds }, istAktiv: true },
      select: { id: true, rolle: true },
    });

    if (personen.length !== personIds.length) {
      return NextResponse.json(
        { error: "Mindestens eine Person existiert nicht oder ist deaktiviert." },
        { status: 400 },
      );
    }

    // Wer schon einem anderen Posten zugeteilt ist, kann hier nicht nochmals
    // zugeteilt werden — Verschieben heisst: zuerst am alten Posten entfernen.
    if (personIds.length > 0) {
      const konflikte = await prisma.gameCrew.findMany({
        where: { personId: { in: personIds }, gameId: { not: id } },
        select: { person: { select: { name: true } }, game: { select: { name: true } } },
      });
      if (konflikte.length > 0) {
        return NextResponse.json(
          {
            error: `Bereits einem anderen Posten zugeteilt: ${konflikte
              .map((k) => `${k.person.name} (${k.game.name})`)
              .join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

    const crew = await prisma.$transaction(async (tx) => {
      await tx.gameCrew.deleteMany({ where: { gameId: id } });
      if (personen.length > 0) {
        await tx.gameCrew.createMany({
          data: personen.map((p) => ({
            gameId: id,
            personId: p.id,
            rolle: p.rolle,
          })),
        });
      }
      return tx.gameCrew.findMany({
        where: { gameId: id },
        select: CREW_SELECT,
        orderBy: { person: { name: "asc" } },
      });
    });

    return NextResponse.json(crew);
  } catch (error) {
    console.error(`PUT /api/games/${id}/crew error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Posten-Crew" },
      { status: 500 },
    );
  }
}
