import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ slug: string }> };

// GET /api/games/by-slug/:slug – Game per Slug laden (für Schiedsrichter)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  try {
    const game = await prisma.game.findUnique({
      where: { slug },
      include: {
        varianten: { where: { istAktiv: true } },
        materialItems: {
          select: { id: true, name: true, menge: true, status: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error(`GET /api/games/by-slug/${slug} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Games" },
      { status: 500 }
    );
  }
}
