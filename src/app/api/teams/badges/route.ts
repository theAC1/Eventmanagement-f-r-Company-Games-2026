import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

const BADGE_SELECT = {
  id: true,
  name: true,
  nummer: true,
  farbe: true,
  logoUrl: true,
  motto: true,
  qrToken: true,
  checkinCode: true,
} as const;

/**
 * GET /api/teams/badges — Badge-Druckdaten für ALLE Teams.
 *
 * Bewusst ein eigener ORGA-Endpoint statt GET /api/teams: Dort sind
 * qrToken/checkinCode aus Sicherheitsgründen aus TEAM_PUBLIC_SELECT
 * entfernt (SCHIEDSRICHTER-erreichbar). Der Badge-Druck ("Alle Teams")
 * braucht aber genau diese Felder für jedes Team — hier stehen sie nur
 * ORGA+ zur Verfügung, wie auch schon der Einzel-Team-Fetch.
 */
export async function GET() {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const teams = await prisma.team.findMany({
      select: BADGE_SELECT,
      orderBy: { nummer: "asc" },
    });
    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET /api/teams/badges error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Badge-Daten" }, { status: 500 });
  }
}
