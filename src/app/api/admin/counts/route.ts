import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import {
  durchgaengeAusSlots,
  pruefeZeitplanAktualitaet,
} from "@/lib/zeitplan-aktualitaet";
import { ladeAktuellenStand } from "@/lib/zeitplan-eingaben";
import { getCurrentZeitplanConfig } from "@/lib/zeitplan-config";

export type AdminCounts = {
  games: number;
  teams: number;
  materials: number;
  personen: number;
  /** Posten = Summe der Durchgänge aller bereiten Games. */
  posten: number;
  zeitplan: {
    vorhanden: boolean;
    aktuell: boolean;
    abweichungen: number;
  };
};

/**
 * GET /api/admin/counts
 *
 * Eine Abfrage für alles, was in der Navigation als Zahl steht — plus die
 * Antwort auf "passt der Zeitplan noch zu den Stammdaten?". Die Sidebar holt
 * sich das nach jeder Änderung neu, statt bis zum nächsten Reload zu lügen.
 */
export async function GET() {
  const { error } = await requireRole("ORGA");
  if (error) return error;

  try {
    const [games, teams, materials, personen, stand, config] = await Promise.all([
      prisma.game.count(),
      prisma.team.count(),
      prisma.materialItem.count(),
      prisma.person.count({ where: { istAktiv: true } }),
      ladeAktuellenStand(),
      getCurrentZeitplanConfig(),
    ]);

    const posten = stand.games.reduce((s, g) => s + g.durchgaenge, 0);

    if (!config) {
      const antwort: AdminCounts = {
        games,
        teams,
        materials,
        personen,
        posten,
        zeitplan: { vorhanden: false, aktuell: true, abweichungen: 0 },
      };
      return NextResponse.json(antwort);
    }

    const slots = await prisma.zeitplanSlot.findMany({
      where: { configId: config.id },
      select: { gameId: true, teams: { select: { teamId: true } } },
    });

    const aufbereitet = slots.map((s) => ({
      gameId: s.gameId ?? "",
      teamIds: s.teams.map((t) => t.teamId),
    }));
    const teamIds = [...new Set(aufbereitet.flatMap((s) => s.teamIds))];

    const aktualitaet = pruefeZeitplanAktualitaet(
      { teamIds, durchgaengeProGame: durchgaengeAusSlots(aufbereitet) },
      stand,
    );

    const antwort: AdminCounts = {
      games,
      teams,
      materials,
      personen,
      posten,
      zeitplan: {
        vorhanden: true,
        aktuell: aktualitaet.aktuell,
        abweichungen: aktualitaet.abweichungen.length,
      },
    };
    return NextResponse.json(antwort);
  } catch (error) {
    console.error("GET /api/admin/counts error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kennzahlen" },
      { status: 500 },
    );
  }
}
