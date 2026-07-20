import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// POST /api/partie/start
router.post("/start", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const { gameId, teamIds, zeitplanSlotId } = req.body as { gameId: string; teamIds: string[]; zeitplanSlotId?: string };
    if (!gameId || !Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({ error: "gameId und mindestens ein teamId sind erforderlich" });
    }
    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });
    if (!gamedayConfig) {
      return res.status(400).json({ error: "Kein aktiver Gameday — Partien können nur während eines aktiven Gamedays gestartet werden" });
    }
    const istTest = gamedayConfig.modus === "TEST";

    const ergebnisse = await prisma.$transaction(async (tx) => {
      const results = await Promise.all(
        teamIds.map((teamId) =>
          tx.ergebnis.upsert({
            where: { gameId_teamId: { gameId, teamId } },
            create: {
              gameId, teamId, zeitplanSlotId: zeitplanSlotId ?? null,
              rohdaten: {}, gamePunkte: null, status: "LAUFEND",
              eingetragenVonId: user.id, eingetragenUm: new Date(), istTest,
            },
            update: {
              status: "LAUFEND", rohdaten: {}, zeitplanSlotId: zeitplanSlotId ?? null,
              eingetragenVonId: user.id, eingetragenUm: new Date(), istTest,
            },
          }),
        ),
      );
      if (zeitplanSlotId) {
        await tx.zeitplanSlot.update({ where: { id: zeitplanSlotId }, data: { status: "AKTIV" } });
      }
      return results;
    });
    return res.status(201).json(ergebnisse);
  } catch (error) {
    console.error("POST /api/partie/start error:", error);
    return res.status(500).json({ error: "Fehler beim Starten der Partie" });
  }
});

export default router;
