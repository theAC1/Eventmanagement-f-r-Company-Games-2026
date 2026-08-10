import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { hasMinRole } from "@/lib/roles";
import { ErgebnisUpdateSchema, zodValidationError } from "@/lib/schemas";
import {
  berechneGamePunkteAusRohdaten,
  synchronisiereDuellSpiegel,
  updateGameRaenge,
} from "@/lib/game-punkte";
import { validiereRohdaten } from "@/lib/rohdaten-validierung";
import type { Prisma } from "@prisma/client";
import {
  sanitizeWertungslogikFuerSchiedsrichter,
  type Wertungslogik,
} from "@/lib/wertungslogik-types";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/ergebnisse/:id
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  const { id } = await params;
  try {
    const ergebnis = await prisma.ergebnis.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
        team: { select: { id: true, name: true, nummer: true } },
        eingetragenVon: { select: { id: true, name: true } },
        histories: {
          orderBy: { geaendertUm: "desc" },
          include: {
            geaendertVon: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!ergebnis) {
      return NextResponse.json({ error: "Ergebnis nicht gefunden" }, { status: 404 });
    }

    // Protokoll: Schiedsrichter sehen die Gewichtung nicht — vertrauliche
    // Wertungs-Keys (gewichtungG/gewichtungSieg) nur an ORGA+ ausliefern
    if (!hasMinRole(session?.user.rolle ?? "", "ORGA")) {
      return NextResponse.json({
        ...ergebnis,
        game: {
          ...ergebnis.game,
          wertungslogik: sanitizeWertungslogikFuerSchiedsrichter(
            ergebnis.game.wertungslogik as Wertungslogik | null,
          ),
        },
      });
    }

    return NextResponse.json(ergebnis);
  } catch (error) {
    console.error(`GET /api/ergebnisse/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Ergebnisses" },
      { status: 500 },
    );
  }
}

// PUT /api/ergebnisse/:id
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
      include: {
        game: { select: { id: true, wertungslogik: true } },
      },
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

    const userId = session?.user?.id ?? null;
    const istCornholeDuell = wertungslogik?.typ === "duell_kleinbegegnungen";

    const { ergebnis, spiegelOk } = await prisma.$transaction(async (tx) => {
      const result = await tx.ergebnis.update({
        where: { id },
        data: {
          rohdaten: rohdaten as Prisma.InputJsonValue,
          gamePunkte,
          status: "KORRIGIERT",
          eingetragenUm: new Date(),
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
          statusNachher: "KORRIGIERT",
          grund: grund ?? null,
          geaendertVonId: userId,
        },
      });

      // Cornhole-Duell: das Partner-Ergebnis ist eine gespiegelte Kopie
      // derselben Kleinbegegnungen — Spiegel-Invariante mitkorrigieren
      const partnerSynchronisiert = istCornholeDuell
        ? await synchronisiereDuellSpiegel(
            result,
            rohdaten as Record<string, unknown>,
            wertungslogik,
            userId,
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
    console.error(`PUT /api/ergebnisse/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Ergebnisses" },
      { status: 500 },
    );
  }
}
