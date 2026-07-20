import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";
import { TeamCreateSchema, TeamUpdateSchema, zodValidationError } from "../lib/schemas";
import { generateUniqueCheckinCode } from "../lib/checkin-code";

const router = Router();

const TEAM_PUBLIC_SELECT = {
  id: true, name: true, nummer: true, captainName: true, captainEmail: true,
  farbe: true, logoUrl: true, motto: true, teilnehmerAnzahl: true, teilnehmerNamen: true,
  createdAt: true, updatedAt: true,
} as const;

const BADGE_SELECT = {
  id: true, name: true, nummer: true, farbe: true, logoUrl: true, motto: true,
  qrToken: true, checkinCode: true,
} as const;

// GET /api/teams
router.get("/", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const teams = await prisma.team.findMany({ select: TEAM_PUBLIC_SELECT, orderBy: { nummer: "asc" } });
    return res.json(teams);
  } catch (error) {
    console.error("GET /api/teams error:", error);
    return res.status(500).json({ error: "Fehler beim Laden der Teams" });
  }
});

// GET /api/teams/badges — all teams' badge data (for print-all). Registered
// before "/:id" so "badges" is not interpreted as a team id.
router.get("/badges", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const teams = await prisma.team.findMany({ select: BADGE_SELECT, orderBy: { nummer: "asc" } });
    return res.json(teams);
  } catch (error) {
    console.error("GET /api/teams/badges error:", error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// GET /api/teams/:id
router.get("/:id", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  const { id } = req.params;
  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        ergebnisse: { include: { game: { select: { name: true } } }, orderBy: { game: { name: "asc" } } },
      },
    });
    if (!team) return res.status(404).json({ error: "Team nicht gefunden" });
    // Don't expose qrToken/checkinCode
    const { qrToken, checkinCode, ...safeTeam } = team as any;
    return res.json(safeTeam);
  } catch (error) {
    console.error(`GET /api/teams/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Laden des Teams" });
  }
});

// GET /api/teams/:id/badge
router.get("/:id/badge", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  const { id } = req.params;
  try {
    const team = await prisma.team.findUnique({
      where: { id },
      select: BADGE_SELECT,
    });
    if (!team) return res.status(404).json({ error: "Team nicht gefunden" });
    return res.json(team);
  } catch (error) {
    console.error(`GET /api/teams/${id}/badge error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

// POST /api/teams
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const parsed = TeamCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

    const data = parsed.data;
    const existing = await prisma.team.findMany({ select: { checkinCode: true } });
    const existingCodes = new Set<string>(existing.map((t: { checkinCode: string }) => t.checkinCode).filter(Boolean));
    const checkinCode = generateUniqueCheckinCode(existingCodes);

    const team = await prisma.team.create({
      data: {
        name: data.name, nummer: data.nummer,
        captainName: data.captainName || null, captainEmail: data.captainEmail || null,
        farbe: data.farbe || "#6b7280", logoUrl: data.logoUrl || null,
        motto: data.motto || null, teilnehmerAnzahl: data.teilnehmerAnzahl || null,
        teilnehmerNamen: data.teilnehmerNamen || null,
        checkinCode, createdById: user.id,
      },
    });
    return res.status(201).json(team);
  } catch (error) {
    console.error("POST /api/teams error:", error);
    return res.status(500).json({ error: "Fehler beim Erstellen des Teams" });
  }
});

// PUT /api/teams/:id
router.put("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    const parsed = TeamUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodValidationError(parsed.error));

    const data = parsed.data;
    const team = await prisma.team.update({
      where: { id },
      data: { ...data, updatedById: user.id },
    });
    return res.json(team);
  } catch (error) {
    console.error(`PUT /api/teams/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Teams" });
  }
});

// DELETE /api/teams/:id
router.delete("/:id", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  const { id } = req.params;
  try {
    await prisma.team.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/teams/${id} error:`, error);
    return res.status(500).json({ error: "Fehler beim Löschen des Teams" });
  }
});

export default router;
