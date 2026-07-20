import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// POST /api/qr
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ error: "QR-Token fehlt" });
    const team = await prisma.team.findUnique({
      where: { qrToken },
      select: { id: true, name: true, nummer: true },
    });
    if (!team) return res.status(404).json({ error: "Ungültiger QR-Code", verified: false });
    return res.json({ verified: true, teamId: team.id, teamName: team.name, teamNummer: team.nummer });
  } catch (error) {
    console.error("POST /api/qr error:", error);
    return res.status(500).json({ error: "Fehler" });
  }
});

export default router;
