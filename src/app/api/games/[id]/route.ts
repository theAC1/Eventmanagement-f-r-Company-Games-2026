import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/games/:id – Einzelnes Game mit Varianten
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        varianten: { orderBy: { name: "asc" } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        _count: { select: { materialItems: true, ergebnisse: true } },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error(`GET /api/games/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Games" },
      { status: 500 }
    );
  }
}

// PUT /api/games/:id – Game aktualisieren
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const userId = await getCurrentUserId();

    const game = await prisma.game.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        typ: body.typ,
        status: body.status,
        modus: body.modus,
        teamsProSlot: body.teamsProSlot,
        kurzbeschreibung: body.kurzbeschreibung,
        einfuehrungMin: body.einfuehrungMin,
        playtimeMin: body.playtimeMin,
        reserveMin: body.reserveMin,
        regeln: body.regeln,
        wertungstyp: body.wertungstyp,
        wertungslogik: body.wertungslogik,
        flaecheLaengeM: body.flaecheLaengeM,
        flaecheBreiteM: body.flaecheBreiteM,
        helferAnzahl: body.helferAnzahl,
        stromNoetig: body.stromNoetig,
        updatedById: userId,
      },
      include: {
        varianten: { orderBy: { name: "asc" } },
      },
    });

    return NextResponse.json(game);
  } catch (error) {
    console.error(`PUT /api/games/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Games" },
      { status: 500 }
    );
  }
}

// DELETE /api/games/:id – Game löschen
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    await prisma.game.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/games/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Games" },
      { status: 500 }
    );
  }
}
