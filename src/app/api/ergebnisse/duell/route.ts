import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { zodValidationError } from "@/lib/schemas";
import { berechneGamePunkteAusRohdaten, updateGameRaenge } from "@/lib/game-punkte";
import { Prisma } from "@prisma/client";
import type { Wertungslogik } from "@/lib/wertungslogik-types";
import { z } from "zod/v4";

// Bereits ein Ergebnis für eines der Teams vorhanden → Transaktion abbrechen,
// nichts überschreiben (zwei Schiedsrichter, doppelte Eingabe, Netzwerk-Retry)
class DuellConflictError extends Error {
  existing: unknown[];
  constructor(existing: unknown[]) {
    super("Duell-Ergebnis existiert bereits");
    this.name = "DuellConflictError";
    this.existing = existing;
  }
}

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
    const now = new Date();
    const slotId = zeitplanSlotId ?? null;
    const commit = commitId ?? null;

    // Idempotenz: Retry mit demselben commitId gibt die bestehenden Ergebnisse zurück
    if (commit) {
      const [replayA, replayB] = await Promise.all([
        prisma.ergebnis.findUnique({ where: { gameId_teamId: { gameId, teamId: teamAId } } }),
        prisma.ergebnis.findUnique({ where: { gameId_teamId: { gameId, teamId: teamBId } } }),
      ]);
      if (replayA?.commitId === commit && replayB?.commitId === commit) {
        return NextResponse.json({ ergebnisA: replayA, ergebnisB: replayB }, { status: 200 });
      }
    }

    const [ergebnisA, ergebnisB] = await prisma.$transaction(async (tx) => {
      const createTeam = async (
        teamId: string,
        rohdaten: Record<string, unknown>,
        gamePunkte: number,
      ) => {
        const result = await tx.ergebnis.create({
          data: {
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
        });

        await tx.ergebnisHistory.create({
          data: {
            ergebnisId: result.id,
            vorher: Prisma.JsonNull,
            nachher: rohdaten as Prisma.InputJsonValue,
            gamePunkteVorher: null,
            gamePunkteNachher: gamePunkte,
            statusVorher: null,
            statusNachher: result.status,
            geaendertVonId: userId,
          },
        });

        return result;
      };

      // Konfliktprüfung: existiert bereits ein Ergebnis für eines der Teams,
      // wird NICHT überschrieben, sondern die Transaktion mit Konflikt abgebrochen.
      const [existingA, existingB] = await Promise.all([
        tx.ergebnis.findUnique({
          where: { gameId_teamId: { gameId, teamId: teamAId } },
          include: {
            eingetragenVon: { select: { id: true, name: true } },
            team: { select: { id: true, name: true, nummer: true } },
          },
        }),
        tx.ergebnis.findUnique({
          where: { gameId_teamId: { gameId, teamId: teamBId } },
          include: {
            eingetragenVon: { select: { id: true, name: true } },
            team: { select: { id: true, name: true, nummer: true } },
          },
        }),
      ]);

      if (existingA || existingB) {
        throw new DuellConflictError([existingA, existingB].filter(Boolean));
      }

      const a = await createTeam(teamAId, rohdatenA, punksteA);
      const b = await createTeam(teamBId, rohdatenB, punkteB);

      await updateGameRaenge(gameId, wertungslogik, tx);

      return [a, b] as const;
    });

    return NextResponse.json({ ergebnisA, ergebnisB }, { status: 201 });
  } catch (error) {
    if (error instanceof DuellConflictError) {
      return NextResponse.json(
        {
          error: "Für dieses Match wurde bereits ein Ergebnis eingetragen — es wurde nichts überschrieben.",
          conflict: true,
          existing: error.existing,
        },
        { status: 409 },
      );
    }
    // Unique-Constraint-Verletzung: zwei Schiedsrichter haben gleichzeitig gespeichert
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          error: "Ein anderer Schiedsrichter hat soeben ein Ergebnis für dieses Match gespeichert — es wurde nichts überschrieben.",
          conflict: true,
          existing: [],
        },
        { status: 409 },
      );
    }
    console.error("POST /api/ergebnisse/duell error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
