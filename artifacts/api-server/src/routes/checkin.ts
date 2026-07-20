import { Router } from "express";
import { prisma } from "../lib/prisma";
import { hasMinRole, requireRole } from "../middlewares/auth";

const router = Router();

// POST /api/checkin
router.post("/", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const { qrToken, checkinCode, slotId } = req.body;
    if (!qrToken && !checkinCode) {
      return res.status(400).json({ error: "QR-Token oder Check-in-Code erforderlich" });
    }

    // Slot-Guard: Schiedsrichter dürfen nur für ihnen zugewiesene Slots einchecken
    let slot: { id: string; teams: { teamId: string }[] } | null = null;
    if (slotId) {
      const found = await prisma.zeitplanSlot.findUnique({
        where: { id: String(slotId) },
        select: {
          id: true,
          schiedsrichterId: true,
          teams: { select: { teamId: true } },
          personen: { select: { personId: true } },
        },
      });
      if (!found) return res.status(404).json({ error: "Slot nicht gefunden" });
      const isOrga = hasMinRole(user.rolle, "ORGA");
      const assigned =
        found.schiedsrichterId === user.id ||
        found.personen.some((p) => p.personId === user.id);
      if (!isOrga && !assigned) {
        return res.status(403).json({ error: "Du bist diesem Slot nicht zugewiesen" });
      }
      slot = { id: found.id, teams: found.teams };
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
    if (slot && slot.teams.length > 0 && !slot.teams.some((t) => t.teamId === team!.id)) {
      return res
        .status(409)
        .json({ error: "Dieses Team gehört nicht zu dieser Begegnung", verified: false });
    }
    return res.json({ verified: true, teamId: team.id, teamName: team.name, teamNummer: team.nummer, teamFarbe: team.farbe, teamLogo: team.logoUrl });
  } catch (error) {
    console.error("POST /api/checkin error:", error);
    return res.status(500).json({ error: "Fehler" });
  }
});

export default router;
