import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import type { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/ergebnisse/:id/verify
export async function PUT(_request: NextRequest, { params }: RouteParams) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  const { id } = await params;
  try {
    const existing = await prisma.ergebnis.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        rohdaten: true,
        gamePunkte: true,
        zeitplanSlotId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Ergebnis nicht gefunden" }, { status: 404 });
    }

    // Sowohl neu eingetragene als auch (innerhalb der Frist) korrigierte
    // Ergebnisse können vom Schiedsrichter bestätigt werden.
    if (existing.status !== "EINGETRAGEN" && existing.status !== "KORRIGIERT") {
      return NextResponse.json(
        { error: "Nur eingetragene oder korrigierte Ergebnisse können verifiziert werden" },
        { status: 400 },
      );
    }

    const userId = session?.user?.id ?? null;

    const ergebnis = await prisma.$transaction(async (tx) => {
      const result = await tx.ergebnis.update({
        where: { id },
        data: { status: "VERIFIZIERT" },
      });

      if (existing.zeitplanSlotId) {
        await tx.zeitplanSlot.update({
          where: { id: existing.zeitplanSlotId },
          data: { status: "ABGESCHLOSSEN" },
        });
      }

      await tx.ergebnisHistory.create({
        data: {
          ergebnisId: result.id,
          vorher: existing.rohdaten as Prisma.InputJsonValue,
          nachher: existing.rohdaten as Prisma.InputJsonValue,
          gamePunkteVorher: existing.gamePunkte,
          gamePunkteNachher: existing.gamePunkte,
          statusVorher: existing.status,
          statusNachher: "VERIFIZIERT",
          geaendertVonId: userId,
        },
      });

      return result;
    });

    return NextResponse.json(ergebnis);
  } catch (error) {
    console.error(`PUT /api/ergebnisse/${id}/verify error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Verifizieren des Ergebnisses" },
      { status: 500 },
    );
  }
}
