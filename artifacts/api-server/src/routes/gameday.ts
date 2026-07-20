import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole, getAuthUser } from "../middlewares/auth";
import { updateGameRaenge } from "../lib/game-punkte";
import type { Wertungslogik } from "../lib/wertungslogik-types";

const router = Router();

// GET /api/gameday
router.get("/", async (req, res) => {
  try {
    const config = await prisma.gamedayConfig.findFirst({
      orderBy: { createdAt: "desc" },
      include: { startedBy: { select: { id: true, name: true } } },
    });
    const testErgebnisse = await prisma.ergebnis.count({ where: { istTest: true } });
    if (!config || config.modus === "INAKTIV") return res.json({ modus: "INAKTIV", active: false, testErgebnisse });
    return res.json({ modus: config.modus, active: true, startedAt: config.startedAt, startedBy: config.startedBy, id: config.id, testErgebnisse });
  } catch (error) {
    console.error("GET /api/gameday error:", error);
    return res.status(500).json({ error: "Fehler beim Laden des Gameday-Status" });
  }
});

// POST /api/gameday
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const { modus } = req.body as { modus: string };
    if (modus !== "TEST" && modus !== "HOT") {
      return res.status(400).json({ error: "Ungültiger Modus. Erlaubt: TEST, HOT" });
    }
    const active = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });
    if (active) return res.status(400).json({ error: "Gameday läuft bereits" });

    if (modus === "HOT") {
      const testErgebnisse = await prisma.ergebnis.count({ where: { istTest: true } });
      if (testErgebnisse > 0) {
        return res.status(400).json({ error: `Es existieren noch ${testErgebnisse} Test-Ergebnisse. Bitte zuerst über den TEST-Modus zurücksetzen.` });
      }
    }

    const config = await prisma.gamedayConfig.create({
      data: { modus, startedAt: new Date(), startedById: user.id },
      include: { startedBy: { select: { id: true, name: true } } },
    });
    return res.status(201).json(config);
  } catch (error) {
    console.error("POST /api/gameday error:", error);
    return res.status(500).json({ error: "Fehler beim Starten des Gamedays" });
  }
});

// DELETE /api/gameday
router.delete("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const active = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });
    if (!active) return res.status(404).json({ error: "Kein aktiver Gameday gefunden" });
    const updated = await prisma.gamedayConfig.update({
      where: { id: active.id },
      data: { modus: "INAKTIV", endedAt: new Date() },
      include: { startedBy: { select: { id: true, name: true } } },
    });
    return res.json(updated);
  } catch (error) {
    console.error("DELETE /api/gameday error:", error);
    return res.status(500).json({ error: "Fehler beim Beenden des Gamedays" });
  }
});

// POST /api/gameday/reset
router.post("/reset", async (req, res) => {
  const user = requireRole(req, res, "ADMIN");
  if (!user) return;
  try {
    // Löschen von Test-Ergebnissen ist im TEST-Modus sowie bei INAKTIV erlaubt
    // (z.B. um Alt-Testdaten vor dem HOT-Start zu bereinigen). Im HOT-Modus gesperrt.
    const config = await prisma.gamedayConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (config && config.modus === "HOT") {
      return res.status(400).json({ error: "Reset im HOT-Modus nicht möglich" });
    }
    const result = await prisma.$transaction(async (tx) => {
      const testErgebnisse = await tx.ergebnis.findMany({ where: { istTest: true }, select: { id: true, gameId: true } });
      const testIds = testErgebnisse.map((e) => e.id);
      const gameIds = [...new Set(testErgebnisse.map((e) => e.gameId))];
      let deletedHistory = 0, deletedErgebnisse = 0;
      if (testIds.length > 0) {
        const historyResult = await tx.ergebnisHistory.deleteMany({ where: { ergebnisId: { in: testIds } } });
        deletedHistory = historyResult.count;
        const ergebnisResult = await tx.ergebnis.deleteMany({ where: { istTest: true } });
        deletedErgebnisse = ergebnisResult.count;

        // Ränge der betroffenen Games neu berechnen (falls echte Ergebnisse übrig sind)
        const games = await tx.game.findMany({
          where: { id: { in: gameIds } },
          select: { id: true, wertungslogik: true },
        });
        for (const game of games) {
          await updateGameRaenge(game.id, game.wertungslogik as Wertungslogik | null, tx as any);
        }
      }
      return { deletedHistory, deletedErgebnisse };
    });
    return res.json({ deleted: { ergebnisse: result.deletedErgebnisse, history: result.deletedHistory } });
  } catch (error) {
    console.error("POST /api/gameday/reset error:", error);
    return res.status(500).json({ error: "Fehler beim Zurücksetzen der Test-Daten" });
  }
});

export default router;
