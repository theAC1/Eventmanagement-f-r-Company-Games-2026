/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berechneGameRang } from "@/lib/rangpunkte";
import { requireRole } from "@/lib/auth-helpers";
import { ErgebnisCreateSchema, zodValidationError } from "@/lib/schemas";
import type { Prisma } from "@prisma/client";

// GET /api/ergebnisse – Alle Ergebnisse (optional filter by gameId oder teamId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const teamId = searchParams.get("teamId");

    const where: Record<string, unknown> = {};
    if (gameId) where.gameId = gameId;
    if (teamId) where.teamId = teamId;

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
  const { error: authError } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = ErgebnisCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const { gameId, teamId, zeitplanSlotId } = parsed.data;
    const rohdaten = parsed.data.rohdaten as Prisma.InputJsonValue & Record<string, any>;

    // Game + Wertungslogik laden
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, wertungslogik: true, wertungstyp: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Game nicht gefunden" }, { status: 404 });
    }

    // gamePunkte aus Rohdaten berechnen
    const gamePunkte = berechneGamePunkteAusRohdaten(
      rohdaten as Record<string, any>,
      game.wertungslogik as any,
    );

    // Ergebnis erstellen oder aktualisieren (upsert auf gameId+teamId)
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
        eingetragenUm: new Date(),
      },
      update: {
        rohdaten,
        gamePunkte,
        status: "KORRIGIERT",
        eingetragenUm: new Date(),
      },
    });

    // Ränge für dieses Game neu berechnen
    await updateGameRaenge(gameId, game.wertungslogik as any);

    return NextResponse.json(ergebnis, { status: 201 });
  } catch (error) {
    console.error("POST /api/ergebnisse error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}

/**
 * Berechnet gamePunkte aus Rohdaten basierend auf der Wertungslogik
 */
function berechneGamePunkteAusRohdaten(
  rohdaten: Record<string, any>,
  wertungslogik: any,
): number {
  if (!wertungslogik) return 0;

  const typ = wertungslogik.typ;

  switch (typ) {
    case "max_value": {
      const messung = wertungslogik.messung;
      return messung ? (Number(rohdaten[messung]) || 0) : 0;
    }

    case "zeit": {
      // Bei Zeit: Grundzeit + Strafen
      const zeit = Number(rohdaten.zeit_sekunden ?? rohdaten.durchgang_1 ?? 0);
      const strafen = wertungslogik.strafen;
      let strafzeit = 0;
      if (strafen && typeof strafen === "object") {
        for (const [key, sekunden] of Object.entries(strafen)) {
          const anzahl = Number(rohdaten[key] ?? 0);
          strafzeit += anzahl * (sekunden as number);
        }
      }
      // Nicht geschafft = sehr hohe Zeit
      if (rohdaten.nicht_geschafft || rohdaten.geschafft === false) {
        return 99999;
      }
      return zeit + strafzeit;
    }

    case "punkte_duell": {
      // Bei Duell: Differenz oder einfach die eigenen Punkte
      const felder = wertungslogik.eingabefelder;
      if (felder && felder.length >= 1) {
        return Number(rohdaten[felder[0].name] ?? 0);
      }
      return 0;
    }

    case "formel": {
      // Einfache Summe der quadrierten Werte
      const felder = wertungslogik.eingabefelder;
      if (!felder) return 0;
      let summe = 0;
      for (const f of felder) {
        const val = Number(rohdaten[f.name] ?? 0);
        summe += val * val;
      }
      return summe;
    }

    case "multi_level": {
      // Level-Grundpunkte - Zeitmalus
      const levels = wertungslogik.levels;
      const gewaehlterLevel = rohdaten.level as string;
      const level = levels?.find((l: any) => l.name === gewaehlterLevel);
      if (!level) return 0;
      const zeit = Number(rohdaten.zeit_sekunden ?? 0);
      return Math.max(0, level.grundpunkte - zeit * 0.1);
    }

    case "risiko_wahl": {
      // Gewählte Option → Punkte bei Erfolg
      const optionen = wertungslogik.optionen;
      const gewaehlteOption = rohdaten.option as string;
      const option = optionen?.find((o: any) => o.name === gewaehlteOption);
      if (!option) return 0;
      const erfolg = rohdaten.erfolg === true || rohdaten.erfolg === "true";
      return erfolg ? option.punkte_erfolg : option.punkte_fail;
    }

    default:
      return 0;
  }
}

/**
 * Aktualisiert die Ränge für alle Ergebnisse eines Games
 */
async function updateGameRaenge(gameId: string, wertungslogik: any) {
  const ergebnisse = await prisma.ergebnis.findMany({
    where: { gameId, gamePunkte: { not: null } },
    select: { id: true, gameId: true, teamId: true, gamePunkte: true, rohdaten: true },
  });

  const raenge = berechneGameRang(
    ergebnisse.map((e: any) => ({
      ...e,
      rohdaten: (e.rohdaten ?? {}) as Record<string, unknown>,
    })),
    wertungslogik,
  );

  // Batch-Update
  for (const rang of raenge) {
    await prisma.ergebnis.update({
      where: { id: rang.ergebnisId },
      data: {
        rangImGame: rang.rangImGame,
        rangPunkte: rang.rangPunkte,
      },
    });
  }
}
