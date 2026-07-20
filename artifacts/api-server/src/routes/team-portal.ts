import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/team/:token (no auth required — read-only team portal)
router.get("/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const team = await prisma.team.findUnique({
      where: { qrToken: token },
      select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
    });
    if (!team) return res.status(404).json({ error: "Team nicht gefunden" });

    // Latest schedule config (most recent) — only this team's slots
    const latestConfig = await prisma.zeitplanConfig.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    let slots: Array<{
      slotId: string;
      startZeit: string;
      endZeit: string;
      runde: number;
      status: string;
      gameName: string;
      gameSlug: string;
    }> = [];

    if (latestConfig) {
      const slotTeams = await prisma.zeitplanSlotTeam.findMany({
        where: { teamId: team.id, slot: { configId: latestConfig.id } },
        include: {
          slot: {
            select: {
              id: true,
              startZeit: true,
              endZeit: true,
              runde: true,
              status: true,
              game: { select: { name: true, slug: true } },
            },
          },
        },
      });
      slots = slotTeams
        .map((st) => ({
          slotId: st.slot.id,
          startZeit: st.slot.startZeit,
          endZeit: st.slot.endZeit,
          runde: st.slot.runde,
          status: st.slot.status,
          gameName: st.slot.game?.name ?? "–",
          gameSlug: st.slot.game?.slug ?? "",
        }))
        .sort((a, b) => a.startZeit.localeCompare(b.startZeit));
    }

    // Own results only — no ranking relative to other teams
    const ergebnisse = await prisma.ergebnis.findMany({
      where: { teamId: team.id, istTest: false },
      select: {
        id: true,
        gamePunkte: true,
        rangPunkte: true,
        status: true,
        game: { select: { name: true, slug: true } },
      },
      orderBy: { game: { name: "asc" } },
    });
    const rangPunkteSumme = ergebnisse.reduce((sum, e) => sum + (e.rangPunkte ?? 0), 0);

    // Site map: background image of the active Situationsplan (if any)
    const aktivPlan = await prisma.situationsplan.findFirst({
      where: { istAktiv: true },
      select: { hintergrundbildUrl: true },
    });

    return res.json({
      teamId: team.id,
      teamName: team.name,
      teamNummer: team.nummer,
      teamFarbe: team.farbe,
      teamLogo: team.logoUrl,
      slots,
      ergebnisse: ergebnisse.map((e) => ({
        id: e.id,
        gameName: e.game.name,
        gameSlug: e.game.slug,
        gamePunkte: e.gamePunkte,
        rangPunkte: e.rangPunkte,
        status: e.status,
      })),
      rangPunkteSumme,
      lageplanUrl: aktivPlan?.hintergrundbildUrl ?? null,
    });
  } catch (error) {
    console.error(`GET /api/team/${token} error:`, error);
    return res.status(500).json({ error: "Fehler" });
  }
});

export default router;
