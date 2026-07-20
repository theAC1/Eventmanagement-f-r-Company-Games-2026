import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";
import { generateSchedule } from "../lib/schedule-engine";

const router = Router();

type DbSlot = {
  id: string;
  runde: number;
  startZeit: string;
  endZeit: string;
  status: string;
  game: { id: string; name: string; slug: string; schiedsrichterAnzahl: number } | null;
  teams: Array<{ team: { id: string; name: string; nummer: number } }>;
  personen: Array<{ person: { id: string; name: string; rolle: string } }>;
};

// GET /api/schedule
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const configs = await prisma.zeitplanConfig.findMany({
      include: { _count: { select: { slots: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json(configs);
  } catch (error) {
    console.error("GET /api/schedule error:", error);
    return res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// POST /api/schedule/generate
router.post("/generate", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const { blockDauerMin, wechselzeitMin, startZeit, pausen, mittagspause } = req.body;

    const games = await prisma.game.findMany({
      where: { status: { in: ["BEREIT", "AKTIV"] } },
      select: { id: true, name: true, teamsProSlot: true },
      orderBy: { name: "asc" },
    });
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, nummer: true },
      orderBy: { nummer: "asc" },
    });

    if (games.length === 0) {
      return res.status(400).json({ error: "Keine Games mit Status BEREIT oder AKTIV gefunden. Setze Games auf 'Bereit' in der Game-Verwaltung." });
    }
    if (teams.length === 0) {
      return res.status(400).json({ error: "Keine Teams vorhanden. Erstelle zuerst Teams." });
    }

    const result = generateSchedule({ teams, games, blockDauerMin, wechselzeitMin, startZeit, pausen, mittagspause });
    return res.json(result);
  } catch (error) {
    console.error("POST /api/schedule/generate error:", error);
    return res.status(500).json({ error: "Fehler bei der Zeitplan-Generierung" });
  }
});

// POST /api/schedule
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const { name, blockDauerMin, wechselzeitMin, startZeit, endZeit, mittagspause, pausen, slots } = req.body;
    const teamIds = new Set<string>();
    for (const slot of slots) {
      for (const tid of slot.teamIds) teamIds.add(tid);
    }
    const config = await prisma.zeitplanConfig.create({
      data: {
        name, anzahlTeams: teamIds.size, blockDauerMin, wechselzeitMin,
        startZeit, endZeit, pausen: pausen ?? [], mittagspause: mittagspause ?? null,
        slots: {
          create: slots.map((slot: { runde: number; startZeit: string; endZeit: string; gameId: string; teamIds: string[] }) => ({
            runde: slot.runde, startZeit: slot.startZeit, endZeit: slot.endZeit, gameId: slot.gameId,
            teams: { create: slot.teamIds.map((teamId: string) => ({ teamId })) },
          })),
        },
      },
      include: { _count: { select: { slots: true } } },
    });
    return res.status(201).json(config);
  } catch (error) {
    console.error("POST /api/schedule error:", error);
    return res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

// GET /api/schedule/:id
router.get("/:id", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  const { id } = req.params;
  try {
    const config = await prisma.zeitplanConfig.findUnique({
      where: { id },
      include: {
        slots: {
          include: {
            game: { select: { id: true, name: true, slug: true, schiedsrichterAnzahl: true } },
            teams: { include: { team: { select: { id: true, name: true, nummer: true } } } },
            personen: { include: { person: { select: { id: true, name: true, rolle: true } } } },
          },
          orderBy: [{ runde: "asc" }, { startZeit: "asc" }],
        },
      },
    });
    if (!config) return res.status(404).json({ error: "Zeitplan nicht gefunden" });

    const slots = config.slots.map((s: DbSlot) => ({
      slotId: s.id,
      status: s.status,
      runde: s.runde,
      startZeit: s.startZeit,
      endZeit: s.endZeit,
      gameId: s.game?.id ?? "",
      gameName: s.game?.name ?? "–",
      gameSlug: s.game?.slug ?? "",
      teamIds: s.teams.map((t) => t.team.id),
      teamNames: s.teams.map((t) => t.team.name),
      schiedsrichterAnzahl: s.game?.schiedsrichterAnzahl ?? 1,
      personen: s.personen.map((p) => ({ id: p.person.id, name: p.person.name, rolle: p.person.rolle })),
    }));

    return res.json({ ...config, slots });
  } catch (error) {
    console.error(`GET /api/schedule/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// PUT /api/schedule/:id
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const { name, istAktiv } = req.body;
    const config = await prisma.$transaction(async (tx) => {
      if (istAktiv === true) {
        await tx.zeitplanConfig.updateMany({ where: { id: { not: id } }, data: { istAktiv: false } });
      }
      return tx.zeitplanConfig.update({
        where: { id },
        data: { ...(name !== undefined ? { name } : {}), ...(typeof istAktiv === "boolean" ? { istAktiv } : {}) },
      });
    });
    return res.json(config);
  } catch (error) {
    console.error(`PUT /api/schedule/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren" });
  }
});

// DELETE /api/schedule/:id
router.delete("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    await prisma.zeitplanConfig.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/schedule/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Löschen" });
  }
});

export default router;
