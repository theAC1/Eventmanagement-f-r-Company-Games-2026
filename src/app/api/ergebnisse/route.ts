/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { ErgebnisCreateSchema, zodValidationError } from "@/lib/schemas";
import { berechneGamePunkteAusRohdaten, updateGameRaenge } from "@/lib/game-punkte";
import { Prisma } from "@prisma/client";

// GET /api/ergebnisse – Alle Ergebnisse (optional filter, optional activity-mode)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get("activity") === "true";
    const gameId = searchParams.get("gameId");
    const teamId = searchParams.get("teamId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));

    const where: Record<string, unknown> = {};
    if (gameId) where.gameId = gameId;
    if (teamId) where.teamId = teamId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { game: { name: { contains: search, mode: "insensitive" } } },
        { team: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (activity) {
      // Paginierter Activity-Feed, chronologisch
      const [data, total] = await Promise.all([
        prisma.ergebnis.findMany({
          where: where as Prisma.ErgebnisWhereInput,
          include: {
            game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
            team: { select: { id: true, name: true, nummer: true } },
            eingetragenVon: { select: { id: true, name: true } },
          },
          orderBy: { eingetragenUm: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.ergebnis.count({ where: where as Prisma.ErgebnisWhereInput }),
      ]);

      return NextResponse.json({ data, total, page, limit });
    }

    // Standard-Modus (backward compatible)
    const ergebnisse = await prisma.ergebnis.findMany({
      where,
      include: {
        game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
        team: { select: { id: true, name: true, nummer: true } },
      },
      orderBy: [{ game: { name: "asc" } }, { rangImGame: "asc" }],
    });

    return NextResponse.json(ergebnisse);
  } catch (error) {
    console.error("GET /api/ergebnisse error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST /api/ergebnisse – Ergebnis eintragen (Schiedsrichter)
export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
    // Gameday-Modus pruefen
    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });

    if (!gamedayConfig) {
      return NextResponse.json(
        { error: "Kein aktiver Gameday — Ergebnisse können nur während eines aktiven Gamedays erfasst werden" },
        { status: 400 },
      );
    }

    const istTest = gamedayConfig.modus === "TEST";

    const body = await request.json();
    const parsed = ErgebnisCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const { gameId, teamId, zeitplanSlotId, commitId } = parsed.data;
    const rohdaten = parsed.data.rohdaten as Prisma.InputJsonValue & Record<string, any>;

    // Game + Wertungslogik laden
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, wertungslogik: true, wertungstyp: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Game nicht gefunden" }, { status: 404 });
    }

    // Bestehenden Ergebnis laden fuer History
    const existing = await prisma.ergebnis.findUnique({
      where: { gameId_teamId: { gameId, teamId } },
      select: { id: true, rohdaten: true, gamePunkte: true, status: true },
    });

    // gamePunkte aus Rohdaten berechnen
    const gamePunkte = berechneGamePunkteAusRohdaten(
      rohdaten as Record<string, any>,
      game.wertungslogik as any,
    );

    const userId = (session as any)?.user?.id ?? null;
    const isUpdate = !!existing;

    // Ergebnis erstellen oder aktualisieren
    const ergebnis = await prisma.ergebnis.upsert({
      where: {
        gameId_teamId: { gameId, teamId },
      },
      create: {
        gameId,
        teamId,
        zeitplanSlotId: zeitplanSlotId || null,
        rohdaten,
        gamePunkte,
        status: "EINGETRAGEN",
        eingetragenVonId: userId,
        eingetragenUm: new Date(),
        istTest,
        commitId: commitId || null,
      },
      update: {
        rohdaten,
        gamePunkte,
        status: "KORRIGIERT",
        eingetragenVonId: userId,
        eingetragenUm: new Date(),
        istTest,
        commitId: commitId || null,
      },
    });

    // History-Eintrag erstellen
    await prisma.ergebnisHistory.create({
      data: {
        ergebnisId: ergebnis.id,
        vorher: isUpdate ? (existing.rohdaten as Prisma.InputJsonValue) : Prisma.JsonNull,
        nachher: rohdaten,
        gamePunkteVorher: isUpdate ? existing.gamePunkte : null,
        gamePunkteNachher: gamePunkte,
        statusVorher: isUpdate ? existing.status : null,
        statusNachher: ergebnis.status,
        geaendertVonId: userId,
      },
    });

    // Raenge fuer dieses Game neu berechnen
    await updateGameRaenge(gameId, game.wertungslogik as any);

    return NextResponse.json(ergebnis, { status: 201 });
  } catch (error) {
    console.error("POST /api/ergebnisse error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
