import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";

const router = Router();

// Aktiver Zeitplan; Fallback: zuletzt erstellter
async function getCurrentConfig() {
  const aktiv = await prisma.zeitplanConfig.findFirst({
    where: { istAktiv: true },
    select: { id: true, name: true, istAktiv: true },
  });
  if (aktiv) return aktiv;
  return prisma.zeitplanConfig.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, istAktiv: true },
  });
}

// GET /api/schiedsrichter/meine-slots — persönlicher Tagesplan des eingeloggten Schiedsrichters
router.get("/meine-slots", async (req, res) => {
  const user = requireRole(req, res, "SCHIEDSRICHTER");
  if (!user) return;
  try {
    const config = await getCurrentConfig();
    if (!config) return res.json({ config: null, slots: [] });

    const slots = await prisma.zeitplanSlot.findMany({
      where: {
        configId: config.id,
        gameId: { not: null },
        OR: [
          { personen: { some: { personId: user.id } } },
          // Fallback: alte Direkt-Zuweisung über schiedsrichterId
          { schiedsrichterId: user.id },
        ],
      },
      include: {
        game: { select: { id: true, name: true, slug: true, modus: true, teamsProSlot: true } },
        teams: { include: { team: { select: { id: true, name: true, nummer: true, farbe: true } } } },
      },
      orderBy: [{ startZeit: "asc" }, { runde: "asc" }],
    });

    return res.json({
      config: { id: config.id, name: config.name, istAktiv: config.istAktiv },
      slots: slots.map((s) => ({
        slotId: s.id,
        status: s.status,
        runde: s.runde,
        startZeit: s.startZeit,
        endZeit: s.endZeit,
        gameId: s.game?.id ?? "",
        gameName: s.game?.name ?? "–",
        gameSlug: s.game?.slug ?? "",
        gameModus: s.game?.modus ?? "SOLO",
        teamsProSlot: s.game?.teamsProSlot ?? 1,
        teamIds: s.teams.map((t) => t.team.id),
        teamNames: s.teams.map((t) => t.team.name),
      })),
    });
  } catch (error) {
    console.error("GET /api/schiedsrichter/meine-slots error:", error);
    return res.status(500).json({ error: "Fehler beim Laden der Einsätze" });
  }
});

export default router;
