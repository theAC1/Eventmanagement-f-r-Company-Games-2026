import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// POST /api/gameday/reset – Test-Daten zurücksetzen (nur im TEST-Modus)
export async function POST() {
  const { error: authError } = await requireRole("ADMIN");
  if (authError) return authError;

  try {
    // Aktuellen Gameday-Modus pruefen
    const config = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });

    if (!config || config.modus !== "TEST") {
      return NextResponse.json(
        { error: "Reset nur im Test-Modus möglich" },
        { status: 400 },
      );
    }

    // Test-Ergebnisse und zugehoerige History loeschen
    // History zuerst loeschen (FK-Constraint)
    const testErgebnisse = await prisma.ergebnis.findMany({
      where: { istTest: true },
      select: { id: true },
    });

    const testIds = testErgebnisse.map((e) => e.id);

    let deletedHistory = 0;
    let deletedErgebnisse = 0;

    if (testIds.length > 0) {
      const historyResult = await prisma.ergebnisHistory.deleteMany({
        where: { ergebnisId: { in: testIds } },
      });
      deletedHistory = historyResult.count;

      const ergebnisResult = await prisma.ergebnis.deleteMany({
        where: { istTest: true },
      });
      deletedErgebnisse = ergebnisResult.count;
    }

    return NextResponse.json({
      deleted: {
        ergebnisse: deletedErgebnisse,
        history: deletedHistory,
      },
    });
  } catch (error) {
    console.error("POST /api/gameday/reset error:", error);
    return NextResponse.json(
      { error: "Fehler beim Zurücksetzen der Test-Daten" },
      { status: 500 },
    );
  }
}
