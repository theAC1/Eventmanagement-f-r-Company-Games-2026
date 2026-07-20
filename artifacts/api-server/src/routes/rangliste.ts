import { Router } from "express";
import { prisma } from "../lib/prisma";
import { berechneGesamtrangliste } from "../lib/rangpunkte";

const router = Router();

// GET /api/rangliste
router.get("/", async (req, res) => {
  try {
    // Aktiven Gameday-Modus bestimmen: nur im TEST-Modus fliessen Test-Ergebnisse
    // in die Rangliste ein (Probelauf-Scoreboard). In HOT/INAKTIV werden sie
    // ausgeschlossen, damit Probeläufe die echte Rangliste nicht verfälschen.
    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      orderBy: { createdAt: "desc" },
      select: { modus: true },
    });
    const modus = gamedayConfig?.modus ?? "INAKTIV";
    const includeTest = modus === "TEST";

    const ergebnisWhere: Record<string, unknown> = {
      gamePunkte: { not: null },
      rangImGame: { not: null },
    };
    if (!includeTest) ergebnisWhere.istTest = false;

    const [ergebnisse, teams, games] = await Promise.all([
      prisma.ergebnis.findMany({
        where: ergebnisWhere as any,
        select: { id: true, gameId: true, teamId: true, gamePunkte: true, rangImGame: true, rangPunkte: true },
      }),
      prisma.team.findMany({ select: { id: true, name: true, nummer: true }, orderBy: { nummer: "asc" } }),
      prisma.game.findMany({ where: { status: { in: ["BEREIT", "AKTIV"] } }, select: { id: true } }),
    ]);

    const raenge = ergebnisse.map((e: any) => ({
      teamId: e.teamId, gameId: e.gameId, ergebnisId: e.id,
      gamePunkte: e.gamePunkte ?? 0, rangImGame: e.rangImGame ?? 0, rangPunkte: e.rangPunkte ?? 0,
    }));

    const rangliste = berechneGesamtrangliste(raenge, teams, games.length);
    return res.json({
      rangliste,
      totalGames: games.length,
      totalTeams: teams.length,
      ergebnisseEingetragen: ergebnisse.length,
      modus,
      enthaeltTestErgebnisse: includeTest,
    });
  } catch (error) {
    console.error("GET /api/rangliste error:", error);
    return res.status(500).json({ error: "Fehler beim Berechnen" });
  }
});

export default router;
