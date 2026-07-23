import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// GET /api/gameday
export async function GET() {
  try {
    const config = await prisma.gamedayConfig.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        startedBy: { select: { id: true, name: true } },
      },
    });

    if (!config || config.modus === "INAKTIV") {
      return NextResponse.json({ modus: "INAKTIV", active: false });
    }

    return NextResponse.json({
      modus: config.modus,
      active: true,
      startedAt: config.startedAt,
      startedBy: config.startedBy,
      id: config.id,
    });
  } catch (error) {
    console.error("GET /api/gameday error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Gameday-Status" },
      { status: 500 },
    );
  }
}

// POST /api/gameday
export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();
    const { modus } = body as { modus: string };

    if (modus !== "TEST" && modus !== "HOT") {
      return NextResponse.json(
        { error: "Ungültiger Modus. Erlaubt: TEST, HOT" },
        { status: 400 },
      );
    }

    const active = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });

    if (active) {
      return NextResponse.json(
        { error: "Gameday läuft bereits" },
        { status: 400 },
      );
    }

    // Beim Start im HOT-Modus: sicherstellen dass keine Test-Ergebnisse existieren
    if (modus === "HOT") {
      const testErgebnisse = await prisma.ergebnis.count({ where: { istTest: true } });
      if (testErgebnisse > 0) {
        return NextResponse.json(
          { error: `Es existieren noch ${testErgebnisse} Test-Ergebnisse. Bitte zuerst über den TEST-Modus zurücksetzen.` },
          { status: 400 },
        );
      }
    }

    const userId = session?.user?.id ?? null;

    const config = await prisma.gamedayConfig.create({
      data: {
        modus,
        startedAt: new Date(),
        startedById: userId,
      },
      include: {
        startedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/gameday error:", error);
    return NextResponse.json(
      { error: "Fehler beim Starten des Gamedays" },
      { status: 500 },
    );
  }
}

// DELETE /api/gameday
export async function DELETE() {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const active = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });

    if (!active) {
      return NextResponse.json(
        { error: "Kein aktiver Gameday gefunden" },
        { status: 404 },
      );
    }

    const updated = await prisma.gamedayConfig.update({
      where: { id: active.id },
      data: {
        modus: "INAKTIV",
        endedAt: new Date(),
      },
      include: {
        startedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("DELETE /api/gameday error:", error);
    return NextResponse.json(
      { error: "Fehler beim Beenden des Gamedays" },
      { status: 500 },
    );
  }
}
