import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// Aktiver Zeitplan; Fallback: zuletzt erstellter
async function getCurrentConfig() {
  const aktiv = await prisma.zeitplanConfig.findFirst({ where: { istAktiv: true }, select: { id: true, name: true, istAktiv: true, createdAt: true } });
  if (aktiv) return aktiv;
  return prisma.zeitplanConfig.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, istAktiv: true, createdAt: true } });
}

// GET /api/einsatzplan — alle Slots des aktiven Zeitplans mit zugewiesenen Personen
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const config = await getCurrentConfig();
    if (!config) return res.json({ config: null, slots: [] });
    const slots = await prisma.zeitplanSlot.findMany({
      where: { gameId: { not: null }, configId: config.id },
      include: {
        game: { select: { id: true, name: true, slug: true, schiedsrichterAnzahl: true, helferAnzahl: true } },
        teams: { include: { team: { select: { id: true, name: true, nummer: true } } } },
        personen: { include: { person: { select: { id: true, name: true, rolle: true } } } },
        config: { select: { id: true, name: true, createdAt: true } },
      },
      orderBy: [{ runde: "asc" }, { startZeit: "asc" }],
    });
    return res.json({ config, slots });
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

    const slot = await prisma.zeitplanSlot.findUnique({ where: { id: slotId }, select: { id: true, configId: true } });
    if (!slot) return res.status(404).json({ error: "Slot nicht gefunden" });

    const config = await getCurrentConfig();
    if (!config || slot.configId !== config.id) {
      return res.status(400).json({ error: "Slot gehört nicht zum aktuellen Zeitplan — Zuweisung nicht möglich" });
    }

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
