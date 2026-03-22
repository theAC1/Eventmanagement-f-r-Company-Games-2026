/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/situationsplan – Aktiven Situationsplan mit allen Positionen laden
export async function GET() {
  try {
    // Aktiven Plan laden, oder den neuesten
    let plan = await prisma.situationsplan.findFirst({
      where: { istAktiv: true },
      include: {
        gamePositionen: {
          include: {
            game: { select: { id: true, name: true, slug: true, modus: true, flaecheLaengeM: true, flaecheBreiteM: true, helferAnzahl: true, stromNoetig: true } },
          },
        },
        infrastruktur: true,
      },
    });

    if (!plan) {
      // Erstelle Default-Plan
      plan = await prisma.situationsplan.create({
        data: {
          name: "Hauptplan",
          istAktiv: true,
        },
        include: {
          gamePositionen: { include: { game: { select: { id: true, name: true, slug: true, modus: true, flaecheLaengeM: true, flaecheBreiteM: true, helferAnzahl: true, stromNoetig: true } } } },
          infrastruktur: true,
        },
      });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/situationsplan error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// PUT /api/situationsplan – Game-Position setzen/aktualisieren
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, gameId, x, y, rotation } = body;

    if (!planId || !gameId) {
      return NextResponse.json({ error: "planId und gameId erforderlich" }, { status: 400 });
    }

    // Upsert: Position erstellen oder aktualisieren
    const existing = await prisma.gamePosition.findFirst({
      where: { planId, gameId },
    });

    let position;
    if (existing) {
      position = await prisma.gamePosition.update({
        where: { id: existing.id },
        data: { x, y, rotation: rotation ?? 0 },
      });
    } else {
      position = await prisma.gamePosition.create({
        data: { planId, gameId, x, y, rotation: rotation ?? 0 },
      });
    }

    return NextResponse.json(position);
  } catch (error) {
    console.error("PUT /api/situationsplan error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}

// POST /api/situationsplan – Infrastruktur-Element hinzufügen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, typ, label, x, y } = body;

    const element = await prisma.infrastrukturElement.create({
      data: { planId, typ, label: label ?? null, x, y },
    });

    return NextResponse.json(element, { status: 201 });
  } catch (error) {
    console.error("POST /api/situationsplan error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}
