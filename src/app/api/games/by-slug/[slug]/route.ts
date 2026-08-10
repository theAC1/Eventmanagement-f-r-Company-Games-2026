import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { hasMinRole } from "@/lib/roles";
import {
  sanitizeWertungslogikFuerSchiedsrichter,
  type Wertungslogik,
} from "@/lib/wertungslogik-types";

type RouteParams = { params: Promise<{ slug: string }> };

// GET /api/games/by-slug/:slug – Game per Slug laden (für Schiedsrichter)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

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

    // Protokoll: Schiedsrichter sehen die Gewichtung (G etc.) nicht —
    // vertrauliche Wertungs-Keys nur an ORGA+ ausliefern
    if (!hasMinRole(session?.user.rolle ?? "", "ORGA")) {
      return NextResponse.json({
        ...game,
        wertungslogik: sanitizeWertungslogikFuerSchiedsrichter(
          game.wertungslogik as Wertungslogik | null,
        ),
      });
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
