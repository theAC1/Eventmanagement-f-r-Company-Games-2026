import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateGameCreate, validationResponse } from "@/lib/validation";

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
  try {
    const body = await request.json();

    const errors = validateGameCreate(body);
    if (errors.length > 0) {
      return NextResponse.json(validationResponse(errors), { status: 400 });
    }

    // Slug generieren falls nicht vorhanden
    if (!body.slug) {
      body.slug = body.name
        .toLowerCase()
        .replace(/[äÄ]/g, "ae")
        .replace(/[öÖ]/g, "oe")
        .replace(/[üÜ]/g, "ue")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }

    const game = await prisma.game.create({
      data: {
        name: body.name,
        slug: body.slug,
        typ: body.typ,
        modus: body.modus,
        teamsProSlot: body.teamsProSlot ?? 1,
        kurzbeschreibung: body.kurzbeschreibung ?? null,
        einfuehrungMin: body.einfuehrungMin ?? 3,
        playtimeMin: body.playtimeMin ?? 10,
        reserveMin: body.reserveMin ?? 2,
        regeln: body.regeln ?? null,
        wertungstyp: body.wertungstyp ?? null,
        wertungslogik: body.wertungslogik ?? null,
        flaecheLaengeM: body.flaecheLaengeM ?? null,
        flaecheBreiteM: body.flaecheBreiteM ?? null,
        helferAnzahl: body.helferAnzahl ?? 1,
        stromNoetig: body.stromNoetig ?? false,
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
