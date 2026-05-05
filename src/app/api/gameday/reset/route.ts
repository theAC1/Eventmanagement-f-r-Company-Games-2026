import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// POST /api/gameday/reset
export async function POST() {
  const { error: authError } = await requireRole("ADMIN");
  if (authError) return authError;

  try {
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

    const result = await prisma.$transaction(async (tx) => {
      const testErgebnisse = await tx.ergebnis.findMany({
        where: { istTest: true },
        select: { id: true },
      });

      const testIds = testErgebnisse.map((e) => e.id);

      let deletedHistory = 0;
      let deletedErgebnisse = 0;

      if (testIds.length > 0) {
        const historyResult = await tx.ergebnisHistory.deleteMany({
          where: { ergebnisId: { in: testIds } },
        });
        deletedHistory = historyResult.count;

        const ergebnisResult = await tx.ergebnis.deleteMany({
          where: { istTest: true },
        });
        deletedErgebnisse = ergebnisResult.count;
      }

      return { deletedHistory, deletedErgebnisse };
    });

    return NextResponse.json({
      deleted: {
        ergebnisse: result.deletedErgebnisse,
        history: result.deletedHistory,
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
