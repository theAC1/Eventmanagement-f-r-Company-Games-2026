import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { getCurrentZeitplanConfig } from "@/lib/zeitplan-config";

// GET /api/einsatzplan – Alle Slots des aktuellen Zeitplans mit zugewiesenen Personen (ORGA+)
export async function GET() {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const config = await getCurrentZeitplanConfig();
    if (!config) return NextResponse.json({ config: null, slots: [] });

    const slots = await prisma.zeitplanSlot.findMany({
      where: { gameId: { not: null }, configId: config.id },
      include: {
        game: {
          select: {
            id: true,
            name: true,
            slug: true,
            schiedsrichterAnzahl: true,
            helferAnzahl: true,
          },
        },
        teams: { include: { team: { select: { id: true, name: true, nummer: true } } } },
        personen: { include: { person: { select: { id: true, name: true, rolle: true } } } },
        config: { select: { id: true, name: true, createdAt: true } },
      },
      orderBy: [{ runde: "asc" }, { startZeit: "asc" }],
    });

    return NextResponse.json({ config, slots });
  } catch (error) {
    console.error("GET /api/einsatzplan error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Einsatzplans" },
      { status: 500 }
    );
  }
}
