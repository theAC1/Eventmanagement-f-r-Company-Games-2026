import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import { GameCreateSchema, zodValidationError } from "@/lib/schemas";

// GET /api/games – Alle Games mit Varianten-Count
export async function GET() {
  try {
    const games = await prisma.game.findMany({
      include: {
        _count: { select: { varianten: true, materialItems: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(games);
  } catch (error) {
    console.error("GET /api/games error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Games" },
      { status: 500 }
    );
  }
}

// POST /api/games – Neues Game erstellen
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

    // Slug generieren falls nicht vorhanden
    const slug = data.slug || data.name
      .toLowerCase()
      .replace(/[äÄ]/g, "ae")
      .replace(/[öÖ]/g, "oe")
      .replace(/[üÜ]/g, "ue")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const userId = await getCurrentUserId();

    const game = await prisma.game.create({
      data: {
        name: data.name,
        slug,
        typ: data.typ,
        modus: data.modus,
        teamsProSlot: data.teamsProSlot ?? 1,
        kurzbeschreibung: data.kurzbeschreibung ?? null,
        einfuehrungMin: data.einfuehrungMin ?? 3,
        playtimeMin: data.playtimeMin ?? 10,
        reserveMin: data.reserveMin ?? 2,
        regeln: data.regeln ?? null,
        wertungstyp: data.wertungstyp ?? null,
        wertungslogik: data.wertungslogik ?? null,
        flaecheLaengeM: data.flaecheLaengeM ?? null,
        flaecheBreiteM: data.flaecheBreiteM ?? null,
        helferAnzahl: data.helferAnzahl ?? 1,
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
