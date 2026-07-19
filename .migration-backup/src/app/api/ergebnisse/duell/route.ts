import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { zodValidationError } from "@/lib/schemas";
import { berechneGamePunkteAusRohdaten, updateGameRaenge } from "@/lib/game-punkte";
import { Prisma } from "@prisma/client";
import type { Wertungslogik } from "@/lib/wertungslogik-types";
import { z } from "zod/v4";

const DuellErgebnisSchema = z.object({
  gameId: z.string().min(1, "gameId ist erforderlich"),
  teamAId: z.string().min(1, "teamAId ist erforderlich"),
  rohdatenA: z.record(z.string(), z.unknown()),
  teamBId: z.string().min(1, "teamBId ist erforderlich"),
  rohdatenB: z.record(z.string(), z.unknown()),
  zeitplanSlotId: z.string().nullable().optional(),
  commitId: z.string().optional(),
});

// POST /api/ergebnisse/duell — Beide Team-Ergebnisse atomar in einer Transaktion speichern
export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
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
    const parsed = DuellErgebnisSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const { gameId, teamAId, rohdatenA, teamBId, rohdatenB, zeitplanSlotId, commitId } = parsed.data;

    if (teamAId === teamBId) {
      return NextResponse.json({ error: "Team A und Team B müssen unterschiedlich sein" }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, wertungslogik: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Game nicht gefunden" }, { status: 404 });
    }

    const wertungslogik = game.wertungslogik as Wertungslogik | null;
    const punksteA = berechneGamePunkteAusRohdaten(rohdatenA, wertungslogik);
    const punkteB = berechneGamePunkteAusRohdaten(rohdatenB, wertungslogik);
    const userId = session?.user?.id ?? null;

    const existingA = await prisma.ergebnis.findUnique({
      where: { gameId_teamId: { gameId, teamId: teamAId } },
      select: { id: true, rohdaten: true, gamePunkte: true, status: true },
    });
    const existingB = await prisma.ergebnis.findUnique({
      where: { gameId_teamId: { gameId, teamId: teamBId } },
      select: { id: true, rohdaten: true, gamePunkte: true, status: true },
    });

    const [ergebnisA, ergebnisB] = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const slotId = zeitplanSlotId ?? null;
      const commit = commitId ?? null;

      const upsertTeam = async (
        teamId: string,
        rohdaten: Record<string, unknown>,
        gamePunkte: number,
        existing: typeof existingA,
      ) => {
        const result = await tx.ergebnis.upsert({
          where: { gameId_teamId: { gameId, teamId } },
          create: {
            gameId,
            teamId,
            zeitplanSlotId: slotId,
            rohdaten: rohdaten as Prisma.InputJsonValue,
            gamePunkte,
            status: "EINGETRAGEN",
            eingetragenVonId: userId,
            eingetragenUm: now,
            istTest,
            commitId: commit,
          },
          update: {
            rohdaten: rohdaten as Prisma.InputJsonValue,
            gamePunkte,
            status: "KORRIGIERT",
            eingetragenVonId: userId,
            eingetragenUm: now,
            istTest,
            commitId: commit,
          },
        });

        await tx.ergebnisHistory.create({
          data: {
            ergebnisId: result.id,
            vorher: existing ? (existing.rohdaten as Prisma.InputJsonValue) : Prisma.JsonNull,
            nachher: rohdaten as Prisma.InputJsonValue,
            gamePunkteVorher: existing ? existing.gamePunkte : null,
            gamePunkteNachher: gamePunkte,
            statusVorher: existing ? existing.status : null,
            statusNachher: result.status,
            geaendertVonId: userId,
          },
        });

        return result;
      };

      const a = await upsertTeam(teamAId, rohdatenA, punksteA, existingA);
      const b = await upsertTeam(teamBId, rohdatenB, punkteB, existingB);

      await updateGameRaenge(gameId, wertungslogik, tx);

      return [a, b] as const;
    });

    return NextResponse.json({ ergebnisA, ergebnisB }, { status: 201 });
  } catch (error) {
    console.error("POST /api/ergebnisse/duell error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
