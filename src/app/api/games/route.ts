import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import { GameCreateSchema, zodValidationError } from "@/lib/schemas";
import { hasMinRole } from "@/lib/roles";
import {
  sanitizeWertungslogikFuerSchiedsrichter,
  type Wertungslogik,
} from "@/lib/wertungslogik-types";

// GET /api/games
export async function GET() {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
    const games = await prisma.game.findMany({
      include: {
        _count: { select: { varianten: true, materialItems: true, crew: true } },
      },
      orderBy: { name: "asc" },
    });

    // Protokoll: Schiedsrichter sehen die Gewichtung (G etc.) nicht —
    // vertrauliche Wertungs-Keys nur an ORGA+ ausliefern
    if (!hasMinRole(session?.user.rolle ?? "", "ORGA")) {
      return NextResponse.json(
        games.map((game) => ({
          ...game,
          wertungslogik: sanitizeWertungslogikFuerSchiedsrichter(
            game.wertungslogik as Wertungslogik | null,
          ),
        })),
      );
    }

    return NextResponse.json(games);
  } catch (error) {
    console.error("GET /api/games error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Games" },
      { status: 500 }
    );
  }
}

// POST /api/games
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = GameCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const data = parsed.data;

    const slug = data.slug || data.name
      .toLowerCase()
      .replace(/[äÄ]/g, "ae")
      .replace(/[öÖ]/g, "oe")
      .replace(/[üÜ]/g, "ue")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const existingSlug = await prisma.game.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json(
        { error: `Ein Game mit dem Slug "${slug}" existiert bereits.` },
        { status: 409 }
      );
    }

    const userId = await getCurrentUserId();

    const game = await prisma.game.create({
      data: {
        name: data.name,
        slug,
        typ: data.typ,
        modus: data.modus,
        teamsProSlot: data.teamsProSlot ?? 1,
        durchgaenge: data.durchgaenge ?? 1,
        teilnehmerProTeam: data.teilnehmerProTeam ?? null,
        kurzbeschreibung: data.kurzbeschreibung ?? null,
        einfuehrungMin: data.einfuehrungMin ?? 3,
        playtimeMin: data.playtimeMin ?? 10,
        reserveMin: data.reserveMin ?? 2,
        regeln: data.regeln ?? null,
        wertungstyp: data.wertungstyp ?? null,
        wertungslogik:
          data.wertungslogik == null
            ? Prisma.JsonNull
            : (data.wertungslogik as Prisma.InputJsonValue),
        flaecheLaengeM: data.flaecheLaengeM ?? null,
        flaecheBreiteM: data.flaecheBreiteM ?? null,
        helferAnzahl: data.helferAnzahl ?? 1,
        schiedsrichterAnzahl: data.schiedsrichterAnzahl ?? 1,
        stromNoetig: data.stromNoetig ?? false,
        createdById: userId,
      },
    });

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("POST /api/games error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Games" },
      { status: 500 }
    );
  }
}
