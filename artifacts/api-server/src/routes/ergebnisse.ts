import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole, getAuthUser, hasMinRole } from "../middlewares/auth";
import { ErgebnisCreateSchema, ErgebnisUpdateSchema, zodValidationError } from "../lib/schemas";
import { berechneGamePunkteAusRohdaten, updateGameRaenge } from "../lib/game-punkte";
import type { Wertungslogik } from "../lib/wertungslogik-types";

const router = Router();

// Sperrfrist: Schiedsrichter dürfen ein Ergebnis nur 5 Minuten nach
// `eingetragenUm` selbst korrigieren; danach kann nur Admin/Orga korrigieren.
export const KORREKTUR_FENSTER_MS = 5 * 60 * 1000;

function istGesperrt(eingetragenUm: Date | null): boolean {
  if (!eingetragenUm) return false;
  return Date.now() - eingetragenUm.getTime() > KORREKTUR_FENSTER_MS;
}

class LockedError extends Error {
  lockedAt: Date | null;
  constructor(lockedAt: Date | null) {
    super("Korrekturfrist abgelaufen");
    this.name = "LockedError";
    this.lockedAt = lockedAt;
  }
}

class DuellConflictError extends Error {
  existing: unknown[];
  constructor(existing: unknown[]) {
    super("Duell-Ergebnis existiert bereits");
    this.name = "DuellConflictError";
    this.existing = existing;
  }
}

// GET /api/ergebnisse
router.get("/", async (req, res) => {
  const teamIdParam = req.query.teamId as string | undefined;
  if (!teamIdParam) {
    const user = requireRole(req, res, "SCHIEDSRICHTER");
    if (!user) return;
  }

  try {
    const activity = req.query.activity === "true";
    const gameId = req.query.gameId as string | undefined;
    const teamId = req.query.teamId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));

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
      const [data, total] = await Promise.all([
        prisma.ergebnis.findMany({
          where: where as Prisma.ErgebnisWhereInput,
          include: {
            game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
            team: { select: { id: true, name: true, nummer: true } },
            eingetragenVon: { select: { id: true, name: true } },
            zeitplanSlot: { select: { id: true, startZeit: true } },
          },
          orderBy: { eingetragenUm: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.ergebnis.count({ where: where as Prisma.ErgebnisWhereInput }),
      ]);
      return res.json({ data, total, page, limit });
    }

    const ergebnisse = await prisma.ergebnis.findMany({
      where,
      include: {
        game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
        team: { select: { id: true, name: true, nummer: true } },
      },
      orderBy: [{ game: { name: "asc" } }, { rangImGame: "asc" }],
    });
    return res.json(ergebnisse);
  } catch (error) {
    console.error("GET /api/ergebnisse error:", error);
    return res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// POST /api/ergebnisse
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;

  try {
    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });
    if (!gamedayConfig) {
      return res.status(400).json({ error: "Kein aktiver Gameday — Ergebnisse können nur während eines aktiven Gamedays erfasst werden" });
    }
    const istTest = gamedayConfig.modus === "TEST";

    const parsed = ErgebnisCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

    const { gameId, teamId, zeitplanSlotId, commitId } = parsed.data;
    const rohdaten = parsed.data.rohdaten as Prisma.InputJsonValue & Record<string, unknown>;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, wertungslogik: true },
    });
    if (!game) return res.status(404).json({ error: "Game nicht gefunden" });

    const wertungslogik = game.wertungslogik as Wertungslogik | null;
    const gamePunkte = berechneGamePunkteAusRohdaten(rohdaten as Record<string, unknown>, wertungslogik);

    const userId = user.id;
    const now = new Date();
    const slotId = zeitplanSlotId ?? null;
    const commit = commitId ?? null;

    // Idempotenz: gleicher commitId für dasselbe Game/Team bedeutet, dass die
    // Übermittlung bereits verarbeitet wurde (z.B. Retry nach Verbindungsabbruch).
    if (commit) {
      const replay = await prisma.ergebnis.findUnique({ where: { gameId_teamId: { gameId, teamId } } });
      if (replay && replay.commitId === commit) {
        return res.status(200).json(replay);
      }
    }

    const istOrga = hasMinRole(user.rolle, "ORGA");

    const ergebnis = await prisma.$transaction(async (tx) => {
      const existing = await tx.ergebnis.findUnique({ where: { gameId_teamId: { gameId, teamId } } });
      // Sperrfrist: Schiedsrichter dürfen nur innerhalb von 5 Minuten korrigieren
      if (existing && !istOrga && istGesperrt(existing.eingetragenUm)) {
        throw new LockedError(existing.eingetragenUm);
      }
      const result = await tx.ergebnis.upsert({
        where: { gameId_teamId: { gameId, teamId } },
        create: {
          gameId, teamId, zeitplanSlotId: slotId,
          rohdaten: rohdaten as Prisma.InputJsonValue,
          gamePunkte, status: "EINGETRAGEN",
          eingetragenVonId: userId, eingetragenUm: now, istTest, commitId: commit,
        },
        update: {
          rohdaten: rohdaten as Prisma.InputJsonValue,
          gamePunkte, status: "KORRIGIERT",
          eingetragenVonId: userId,
          // Timer läuft ab dem ursprünglichen Eintrag weiter
          eingetragenUm: existing?.eingetragenUm ?? now,
          istTest, commitId: commit,
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

      await updateGameRaenge(gameId, wertungslogik, tx as any);
      return result;
    });

    return res.status(201).json(ergebnis);
  } catch (error) {
    if (error instanceof LockedError) {
      return res.status(403).json({
        code: "LOCKED",
        lockedAt: error.lockedAt,
        error: "Die Korrekturfrist von 5 Minuten ist abgelaufen — nur ein Admin kann das Ergebnis noch korrigieren.",
      });
    }
    console.error("POST /api/ergebnisse error:", error);
    return res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

// POST /api/ergebnisse/duell
router.post("/duell", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;

  try {
    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });
    if (!gamedayConfig) {
      return res.status(400).json({ error: "Kein aktiver Gameday" });
    }
    const istTest = gamedayConfig.modus === "TEST";

    const { gameId, teamAId, teamBId, rohdatenA, rohdatenB, zeitplanSlotId, commitId } = req.body;
    if (!gameId || !teamAId || !teamBId || !rohdatenA || !rohdatenB) {
      return res.status(400).json({ error: "gameId, teamAId, teamBId, rohdatenA, rohdatenB erforderlich" });
    }
    if (teamAId === teamBId) {
      return res.status(400).json({ error: "Team A und Team B müssen unterschiedlich sein" });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, wertungslogik: true },
    });
    if (!game) return res.status(404).json({ error: "Game nicht gefunden" });

    const wertungslogik = game.wertungslogik as Wertungslogik | null;
    const punksteA = berechneGamePunkteAusRohdaten(rohdatenA as Record<string, unknown>, wertungslogik);
    const punkteB = berechneGamePunkteAusRohdaten(rohdatenB as Record<string, unknown>, wertungslogik);

    const userId = user.id;
    const now = new Date();
    const slotId = zeitplanSlotId ?? null;
    const commit = commitId ?? null;

    const [ergebnisA, ergebnisB] = await prisma.$transaction(async (tx) => {
      const createTeam = async (teamId: string, rohdaten: Record<string, unknown>, gamePunkte: number) => {
        const result = await tx.ergebnis.create({
          data: {
            gameId, teamId, zeitplanSlotId: slotId,
            rohdaten: rohdaten as Prisma.InputJsonValue,
            gamePunkte, status: "EINGETRAGEN",
            eingetragenVonId: userId, eingetragenUm: now, istTest, commitId: commit,
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
          include: { eingetragenVon: { select: { id: true, name: true } }, team: { select: { id: true, name: true, nummer: true } } },
        }),
        tx.ergebnis.findUnique({
          where: { gameId_teamId: { gameId, teamId: teamBId } },
          include: { eingetragenVon: { select: { id: true, name: true } }, team: { select: { id: true, name: true, nummer: true } } },
        }),
      ]);

      if (existingA || existingB) {
        throw new DuellConflictError([existingA, existingB].filter(Boolean));
      }

      const a = await createTeam(teamAId, rohdatenA, punksteA);
      const b = await createTeam(teamBId, rohdatenB, punkteB);

      await updateGameRaenge(gameId, wertungslogik, tx as any);
      return [a, b] as const;
    });

    return res.status(201).json({ ergebnisA, ergebnisB });
  } catch (error) {
    if (error instanceof DuellConflictError) {
      return res.status(409).json({
        error: "Für dieses Match wurde bereits ein Ergebnis eingetragen — es wurde nichts überschrieben.",
        conflict: true,
        existing: error.existing,
      });
    }
    // Unique-Constraint-Verletzung: zwei Schiedsrichter haben gleichzeitig gespeichert
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        error: "Ein anderer Schiedsrichter hat soeben ein Ergebnis für dieses Match gespeichert — es wurde nichts überschrieben.",
        conflict: true,
        existing: [],
      });
    }
    console.error("POST /api/ergebnisse/duell error:", error);
    return res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

// GET /api/ergebnisse/:id
router.get("/:id", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  const { id } = req.params;
  try {
    const ergebnis = await prisma.ergebnis.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
        team: { select: { id: true, name: true, nummer: true } },
        eingetragenVon: { select: { id: true, name: true } },
        histories: {
          orderBy: { geaendertUm: "desc" },
          include: { geaendertVon: { select: { id: true, name: true } } },
        },
      },
    });
    if (!ergebnis) return res.status(404).json({ error: "Ergebnis nicht gefunden" });
    return res.json(ergebnis);
  } catch (error) {
    console.error(`GET /api/ergebnisse/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Laden des Ergebnisses" });
  }
});

// PUT /api/ergebnisse/:id
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const parsed = ErgebnisUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

    const { rohdaten, grund } = parsed.data;
    const existing = await prisma.ergebnis.findUnique({
      where: { id },
      include: { game: { select: { id: true, wertungslogik: true } } },
    });
    if (!existing) return res.status(404).json({ error: "Ergebnis nicht gefunden" });

    const wertungslogik = existing.game.wertungslogik as Wertungslogik | null;
    const gamePunkte = berechneGamePunkteAusRohdaten(rohdaten as Record<string, unknown>, wertungslogik);

    const ergebnis = await prisma.$transaction(async (tx) => {
      const result = await tx.ergebnis.update({
        where: { id },
        data: {
          rohdaten: rohdaten as Prisma.InputJsonValue,
          gamePunkte, status: "KORRIGIERT", eingetragenUm: new Date(),
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
          geaendertVonId: user.id,
        },
      });
      await updateGameRaenge(existing.game.id, wertungslogik, tx as any);
      return result;
    });
    return res.json(ergebnis);
  } catch (error) {
    console.error(`PUT /api/ergebnisse/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Ergebnisses" });
  }
});

// PUT /api/ergebnisse/:id/admin-korrektur
// Admin/Orga überschreibt ein (ggf. gesperrtes) Ergebnis direkt → Status VERIFIZIERT.
router.put("/:id/admin-korrektur", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const parsed = ErgebnisUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

    const { rohdaten, grund } = parsed.data;
    const existing = await prisma.ergebnis.findUnique({
      where: { id },
      include: { game: { select: { id: true, wertungslogik: true } } },
    });
    if (!existing) return res.status(404).json({ error: "Ergebnis nicht gefunden" });

    const wertungslogik = existing.game.wertungslogik as Wertungslogik | null;
    const gamePunkte = berechneGamePunkteAusRohdaten(rohdaten as Record<string, unknown>, wertungslogik);

    const ergebnis = await prisma.$transaction(async (tx) => {
      const result = await tx.ergebnis.update({
        where: { id },
        data: {
          rohdaten: rohdaten as Prisma.InputJsonValue,
          gamePunkte, status: "VERIFIZIERT",
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
          geaendertVonId: user.id,
        },
      });
      await updateGameRaenge(existing.game.id, wertungslogik, tx as any);
      return result;
    });
    return res.json(ergebnis);
  } catch (error) {
    console.error(`PUT /api/ergebnisse/${id}/admin-korrektur error:`, error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Ergebnisses" });
  }
});

// PUT /api/ergebnisse/:id/verify
router.put("/:id/verify", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  const { id } = req.params;
  try {
    const existing = await prisma.ergebnis.findUnique({
      where: { id },
      select: { id: true, status: true, rohdaten: true, gamePunkte: true, zeitplanSlotId: true },
    });
    if (!existing) return res.status(404).json({ error: "Ergebnis nicht gefunden" });
    // Sowohl neu eingetragene als auch (innerhalb der Frist) korrigierte
    // Ergebnisse können vom Schiedsrichter bestätigt werden.
    if (existing.status !== "EINGETRAGEN" && existing.status !== "KORRIGIERT") {
      return res.status(400).json({ error: "Nur eingetragene oder korrigierte Ergebnisse können verifiziert werden" });
    }

    const ergebnis = await prisma.$transaction(async (tx) => {
      const result = await tx.ergebnis.update({ where: { id }, data: { status: "VERIFIZIERT" } });
      if (existing.zeitplanSlotId) {
        await tx.zeitplanSlot.update({ where: { id: existing.zeitplanSlotId }, data: { status: "ABGESCHLOSSEN" } });
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
          geaendertVonId: user.id,
        },
      });
      return result;
    });
    return res.json(ergebnis);
  } catch (error) {
    console.error(`PUT /api/ergebnisse/${id}/verify error:`, error);
    return res.status(500).json({ error: "Fehler beim Verifizieren des Ergebnisses" });
  }
});

export default router;
