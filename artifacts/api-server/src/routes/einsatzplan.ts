import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// GET /api/einsatzplan — alle Slots des aktiven Zeitplans mit zugewiesenen Personen
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const slots = await prisma.zeitplanSlot.findMany({
      where: { gameId: { not: null } },
      include: {
        game: { select: { id: true, name: true, slug: true, schiedsrichterAnzahl: true, helferAnzahl: true } },
        teams: { include: { team: { select: { id: true, name: true, nummer: true } } } },
        personen: { include: { person: { select: { id: true, name: true, rolle: true } } } },
        config: { select: { id: true, name: true, createdAt: true } },
      },
      orderBy: [{ runde: "asc" }, { startZeit: "asc" }],
    });
    return res.json(slots);
  } catch (error) {
    console.error("GET /api/einsatzplan error:", error);
    return res.status(500).json({ error: "Fehler beim Laden des Einsatzplans" });
  }
});

// PUT /api/einsatzplan/:slotId/personen — Zuweisung setzen/ersetzen
router.put("/:slotId/personen", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { slotId } = req.params;
  try {
    const { personIds } = req.body as { personIds?: unknown };
    if (!Array.isArray(personIds) || personIds.some((p) => typeof p !== "string")) {
      return res.status(400).json({ error: "personIds (Array von IDs) erforderlich" });
    }
    const uniqueIds = [...new Set(personIds as string[])];

    const slot = await prisma.zeitplanSlot.findUnique({ where: { id: slotId }, select: { id: true } });
    if (!slot) return res.status(404).json({ error: "Slot nicht gefunden" });

    const personen = await prisma.person.findMany({
      where: { id: { in: uniqueIds }, istAktiv: true },
      select: { id: true, rolle: true },
    });
    if (personen.length !== uniqueIds.length) {
      return res.status(400).json({ error: "Eine oder mehrere Personen wurden nicht gefunden oder sind inaktiv" });
    }

    await prisma.$transaction([
      prisma.zeitplanSlotPerson.deleteMany({ where: { slotId } }),
      prisma.zeitplanSlotPerson.createMany({
        data: personen.map((p) => ({ slotId, personId: p.id, rolle: p.rolle })),
      }),
    ]);

    const updated = await prisma.zeitplanSlot.findUnique({
      where: { id: slotId },
      include: { personen: { include: { person: { select: { id: true, name: true, rolle: true } } } } },
    });
    return res.json(updated);
  } catch (error) {
    console.error(`PUT /api/einsatzplan/${slotId}/personen error:`, error);
    return res.status(500).json({ error: "Fehler beim Speichern der Zuweisung" });
  }
});

export default router;
