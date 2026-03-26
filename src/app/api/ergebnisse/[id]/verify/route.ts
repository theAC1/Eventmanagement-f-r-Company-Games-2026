/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import type { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/ergebnisse/:id/verify – Schiedsrichter verifiziert Ergebnis
export async function PUT(_request: NextRequest, { params }: RouteParams) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  const { id } = await params;
  try {
    // Ergebnis laden
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

    if (existing.status !== "EINGETRAGEN") {
      return NextResponse.json(
        { error: "Nur Ergebnisse mit Status EINGETRAGEN können verifiziert werden" },
        { status: 400 },
      );
    }

    const userId = (session as any)?.user?.id ?? null;

    // Status auf VERIFIZIERT setzen
    const ergebnis = await prisma.ergebnis.update({
      where: { id },
      data: { status: "VERIFIZIERT" },
    });

    // ZeitplanSlot auf ABGESCHLOSSEN setzen
    if (existing.zeitplanSlotId) {
      await prisma.zeitplanSlot.update({
        where: { id: existing.zeitplanSlotId },
        data: { status: "ABGESCHLOSSEN" },
      });
    }

    // History-Eintrag erstellen
    await prisma.ergebnisHistory.create({
      data: {
        ergebnisId: ergebnis.id,
        vorher: existing.rohdaten as Prisma.InputJsonValue,
        nachher: existing.rohdaten as Prisma.InputJsonValue,
        gamePunkteVorher: existing.gamePunkte,
        gamePunkteNachher: existing.gamePunkte,
        statusVorher: "EINGETRAGEN",
        statusNachher: "VERIFIZIERT",
        geaendertVonId: userId,
      },
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
