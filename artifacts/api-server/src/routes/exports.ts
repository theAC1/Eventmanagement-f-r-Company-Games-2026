import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middlewares/auth";
import { generateErgebnisseCSV, generateRanglisteCSV, generateTeamsCSV } from "../lib/export";
import { berechneGesamtrangliste } from "../lib/rangpunkte";

const router = Router();

// GET /api/export/ergebnisse
router.get("/ergebnisse", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const gameId = req.query.gameId as string | undefined;
    const where: Record<string, unknown> = {};
    if (gameId) where.gameId = gameId;

    const ergebnisse = await prisma.ergebnis.findMany({
      where,
      include: {
        game: { select: { name: true } },
        team: { select: { name: true, nummer: true } },
      },
      orderBy: [{ game: { name: "asc" } }, { rangImGame: "asc" }],
      take: 10000,
    });

    const csv = generateErgebnisseCSV(
      ergebnisse.map((e) => ({
        gameName: e.game.name,
        teamName: e.team.name,
        teamNummer: e.team.nummer,
        gamePunkte: e.gamePunkte,
        rangImGame: e.rangImGame,
        status: e.status,
        eingetragenUm: e.eingetragenUm?.toISOString() ?? null,
      })),
    );

    const datum = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="ergebnisse-${datum}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("GET /api/export/ergebnisse error:", error);
    return res.status(500).json({ error: "Export fehlgeschlagen" });
  }
});

// GET /api/export/rangliste
router.get("/rangliste", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const [ergebnisse, teams, games] = await Promise.all([
      prisma.ergebnis.findMany({
        where: { gamePunkte: { not: null }, rangImGame: { not: null } },
        select: { id: true, gameId: true, teamId: true, gamePunkte: true, rangImGame: true, rangPunkte: true },
        take: 10000,
      }),
      prisma.team.findMany({ select: { id: true, name: true, nummer: true }, orderBy: { nummer: "asc" }, take: 1000 }),
      prisma.game.findMany({ where: { status: { in: ["BEREIT", "AKTIV"] } }, select: { id: true }, take: 200 }),
    ]);

    const raenge = ergebnisse.map((e: any) => ({
      teamId: e.teamId, gameId: e.gameId, ergebnisId: e.id,
      gamePunkte: e.gamePunkte ?? 0, rangImGame: e.rangImGame ?? 0, rangPunkte: e.rangPunkte ?? 0,
    }));

    const rangliste = berechneGesamtrangliste(raenge, teams, games.length);
    const teamNummerMap = new Map(teams.map((t) => [t.id, t.nummer]));
    const ranglisteWithNummer = rangliste.map((r) => ({ ...r, teamNummer: teamNummerMap.get(r.teamId) }));

    const csv = generateRanglisteCSV(ranglisteWithNummer, {
      totalGames: games.length, totalTeams: teams.length, ergebnisseEingetragen: ergebnisse.length,
    });

    const datum = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="rangliste-${datum}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("GET /api/export/rangliste error:", error);
    return res.status(500).json({ error: "Export fehlgeschlagen" });
  }
});

// GET /api/export/teams
router.get("/teams", async (req, res) => {
  const user = requireRole(req, res, "ORGA");
  if (!user) return;
  try {
    const teams = await prisma.team.findMany({
      select: { nummer: true, name: true, captainName: true, captainEmail: true, farbe: true, teilnehmerAnzahl: true, motto: true },
      orderBy: { nummer: "asc" },
    });
    const csv = generateTeamsCSV(teams);
    const datum = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="teams-${datum}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("GET /api/export/teams error:", error);
    return res.status(500).json({ error: "Export fehlgeschlagen" });
  }
});

export default router;
