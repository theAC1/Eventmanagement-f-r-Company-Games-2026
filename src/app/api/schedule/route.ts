import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/schedule – Alle gespeicherten Zeitpläne
export async function GET() {
  try {
    const configs = await prisma.zeitplanConfig.findMany({
      include: {
        _count: { select: { slots: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error("GET /api/schedule error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST /api/schedule – Zeitplan speichern (Config + Slots)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, blockDauerMin, wechselzeitMin, startZeit, endZeit, mittagspause, pausen, slots } = body;

    // Anzahl Teams aus Slots ableiten
    const teamIds = new Set<string>();
    for (const slot of slots) {
      for (const tid of slot.teamIds) teamIds.add(tid);
    }

    const config = await prisma.zeitplanConfig.create({
      data: {
        name,
        anzahlTeams: teamIds.size,
        blockDauerMin,
        wechselzeitMin,
        startZeit,
        endZeit,
        pausen: pausen ?? [],
        mittagspause: mittagspause ?? null,
        slots: {
          create: slots.map((slot: { runde: number; startZeit: string; endZeit: string; gameId: string; teamIds: string[] }) => ({
            runde: slot.runde,
            startZeit: slot.startZeit,
            endZeit: slot.endZeit,
            gameId: slot.gameId,
            teams: {
              create: slot.teamIds.map((teamId: string) => ({ teamId })),
            },
          })),
        },
      },
      include: {
        _count: { select: { slots: true } },
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/schedule error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
