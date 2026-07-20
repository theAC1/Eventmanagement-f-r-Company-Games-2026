import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/team/:token (no auth required)
router.get("/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const team = await prisma.team.findUnique({
      where: { qrToken: token },
      select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
    });
    if (!team) return res.status(404).json({ error: "Team nicht gefunden" });
    return res.json({
      teamId: team.id,
      teamName: team.name,
      teamNummer: team.nummer,
      teamFarbe: team.farbe,
      teamLogo: team.logoUrl,
    });
  } catch (error) {
    console.error(`GET /api/team/${token} error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

export default router;
