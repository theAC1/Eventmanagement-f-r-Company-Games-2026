import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole, getAuthUser } from "../middlewares/auth";

const router = Router();

// GET /api/gameday
router.get("/", async (req, res) => {
  try {
    const config = await prisma.gamedayConfig.findFirst({
      orderBy: { createdAt: "desc" },
      include: { startedBy: { select: { id: true, name: true } } },
    });
    if (!config || config.modus === "INAKTIV") return res.json({ modus: "INAKTIV", active: false });
    return res.json({ modus: config.modus, active: true, startedAt: config.startedAt, startedBy: config.startedBy, id: config.id });
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
    const config = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });
    if (!config || config.modus !== "TEST") {
      return res.status(400).json({ error: "Reset nur im Test-Modus möglich" });
    }
    const result = await prisma.$transaction(async (tx) => {
      const testErgebnisse = await tx.ergebnis.findMany({ where: { istTest: true }, select: { id: true } });
      const testIds = testErgebnisse.map((e) => e.id);
      let deletedHistory = 0, deletedErgebnisse = 0;
      if (testIds.length > 0) {
        const historyResult = await tx.ergebnisHistory.deleteMany({ where: { ergebnisId: { in: testIds } } });
        deletedHistory = historyResult.count;
        const ergebnisResult = await tx.ergebnis.deleteMany({ where: { istTest: true } });
        deletedErgebnisse = ergebnisResult.count;
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
