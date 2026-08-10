import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { ErgebnisUpdateSchema, zodValidationError } from "@/lib/schemas";
import {
  berechneGamePunkteAusRohdaten,
  synchronisiereDuellSpiegel,
  updateGameRaenge,
} from "@/lib/game-punkte";
import { validiereRohdaten } from "@/lib/rohdaten-validierung";
import { Prisma } from "@prisma/client";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/ergebnisse/[id]/admin-korrektur
// Admin/Orga überschreibt ein (ggf. gesperrtes) Ergebnis direkt → Status VERIFIZIERT.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError, session } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = ErgebnisUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const { rohdaten, grund } = parsed.data;
    const existing = await prisma.ergebnis.findUnique({
      where: { id },
      include: { game: { select: { id: true, wertungslogik: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ergebnis nicht gefunden" }, { status: 404 });
    }

    const wertungslogik = existing.game.wertungslogik as Wertungslogik | null;

    const validierung = validiereRohdaten(wertungslogik, rohdaten as Record<string, unknown>);
    if (!validierung.ok) {
      return NextResponse.json({ error: validierung.fehler }, { status: 400 });
    }

    const gamePunkte = berechneGamePunkteAusRohdaten(
      rohdaten as Record<string, unknown>,
      wertungslogik,
    );

    const istCornholeDuell = wertungslogik?.typ === "duell_kleinbegegnungen";

    const { ergebnis, spiegelOk } = await prisma.$transaction(async (tx) => {
      const result = await tx.ergebnis.update({
        where: { id },
        data: {
          rohdaten: rohdaten as Prisma.InputJsonValue,
          gamePunkte,
          status: "VERIFIZIERT",
        },
      });
      await tx.ergebnisHistory.create({
        data: {
          ergebnisId: result.id,
          vorher: existing.rohdaten as Prisma.InputJsonValue,
          nachher: rohdaten as Prisma.InputJsonValue,
          gamePunkteVorher: existing.gamePunkte,
          gamePunkteNachher: gamePunkte,
          statusVorher: existing.status,
          statusNachher: "VERIFIZIERT",
          grund: grund ?? null,
          geaendertVonId: session!.user.id,
        },
      });

      // Cornhole-Duell: das Partner-Ergebnis ist eine gespiegelte Kopie
      // derselben Kleinbegegnungen — Spiegel-Invariante mitkorrigieren
      const partnerSynchronisiert = istCornholeDuell
        ? await synchronisiereDuellSpiegel(
            result,
            rohdaten as Record<string, unknown>,
            wertungslogik,
            session!.user.id,
            tx,
          )
        : true;

      await updateGameRaenge(existing.game.id, wertungslogik, tx);
      return { ergebnis: result, spiegelOk: partnerSynchronisiert };
    });

    if (istCornholeDuell && !spiegelOk) {
      return NextResponse.json({
        ...ergebnis,
        spiegelHinweis: "Gegner-Ergebnis konnte nicht automatisch angepasst werden",
      });
    }

    return NextResponse.json(ergebnis);
  } catch (error) {
    console.error(`PUT /api/ergebnisse/${id}/admin-korrektur error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Ergebnisses" },
      { status: 500 },
    );
  }
}
