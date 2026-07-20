import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// POST /api/checkin
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const { qrToken, checkinCode } = req.body;
    if (!qrToken && !checkinCode) {
      return res.status(400).json({ error: "QR-Token oder Check-in-Code erforderlich" });
    }
    let team;
    if (checkinCode) {
      team = await prisma.team.findFirst({
        where: { checkinCode: checkinCode.toUpperCase().trim() },
        select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
      });
    } else {
      team = await prisma.team.findUnique({
        where: { qrToken },
        select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
      });
    }
    if (!team) return res.status(404).json({ error: "Team nicht gefunden", verified: false });
    return res.json({ verified: true, teamId: team.id, teamName: team.name, teamNummer: team.nummer, teamFarbe: team.farbe, teamLogo: team.logoUrl });
  } catch (error) {
    console.error("POST /api/checkin error:", error);
    return res.status(500).json({ error: "Fehler" });
  }
});

export default router;
