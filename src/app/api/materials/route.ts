import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-helpers";

// GET /api/materials – Alle Material-Items mit Game + Verantwortlicher
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const kategorie = searchParams.get("kategorie");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (gameId) where.gameId = gameId;
    if (kategorie) where.kategorie = kategorie;
    if (status) where.status = status;

    const items = await prisma.materialItem.findMany({
      where,
      include: {
        game: { select: { id: true, name: true, slug: true } },
        verantwortlich: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        _count: { select: { kommentare: true } },
      },
      orderBy: [{ game: { name: "asc" } }, { name: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/materials error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Materialien" },
      { status: 500 }
    );
  }
}

// POST /api/materials – Neues Material-Item erstellen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const userId = await getCurrentUserId();

    const item = await prisma.materialItem.create({
      data: {
        name: body.name,
        gameId: body.gameId || null,
        kategorie: body.kategorie,
        menge: body.menge || null,
        beschreibung: body.beschreibung || null,
        status: body.status || "OFFEN",
        sponsor: body.sponsor || null,
        kostenGeschaetzt: body.kostenGeschaetzt || null,
        kostenEffektiv: body.kostenEffektiv || null,
        createdById: userId,
      },
      include: {
        game: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/materials error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Materials" },
      { status: 500 }
    );
  }
}
