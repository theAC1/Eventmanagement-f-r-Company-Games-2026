import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole, getAuthUser } from "../middlewares/auth";
import { ErgebnisCreateSchema, ErgebnisUpdateSchema, zodValidationError } from "../lib/schemas";
import { berechneGamePunkteAusRohdaten, updateGameRaenge } from "../lib/game-punkte";
import type { Wertungslogik } from "../lib/wertungslogik-types";

const router = Router();

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

    const ergebnis = await prisma.$transaction(async (tx) => {
      const existing = await tx.ergebnis.findUnique({ where: { gameId_teamId: { gameId, teamId } } });
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
          eingetragenVonId: userId, eingetragenUm: now, istTest, commitId: commit,
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
      const upsertTeam = async (teamId: string, rohdaten: Record<string, unknown>, gamePunkte: number, existing: any) => {
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
            eingetragenVonId: userId, eingetragenUm: now, istTest, commitId: commit,
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

      const [existingA, existingB] = await Promise.all([
        tx.ergebnis.findUnique({ where: { gameId_teamId: { gameId, teamId: teamAId } } }),
        tx.ergebnis.findUnique({ where: { gameId_teamId: { gameId, teamId: teamBId } } }),
      ]);

      const a = await upsertTeam(teamAId, rohdatenA, punksteA, existingA);
      const b = await upsertTeam(teamBId, rohdatenB, punkteB, existingB);

      await updateGameRaenge(gameId, wertungslogik, tx as any);
      return [a, b] as const;
    });

    return res.status(201).json({ ergebnisA, ergebnisB });
  } catch (error) {
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
    if (existing.status !== "EINGETRAGEN") {
      return res.status(400).json({ error: "Nur Ergebnisse mit Status EINGETRAGEN können verifiziert werden" });
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
          statusVorher: "EINGETRAGEN",
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
