import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { hatLuecken, neueNummern } from "@/lib/team-nummern";

/**
 * Beim Umnummerieren tauschen Teams ihre Nummern — jeder direkte Weg würde
 * unterwegs auf den Unique-Index laufen. Deshalb erst alle in einen Bereich
 * schieben, den niemand belegt, dann auf die Zielnummern.
 */
const PARKBEREICH = 100_000;

// GET /api/teams/nummern – hat die Reihe Lücken?
export async function GET() {
  const { error } = await requireRole("ORGA");
  if (error) return error;

  try {
    const teams = await prisma.team.findMany({
      select: { id: true, nummer: true },
      orderBy: { nummer: "asc" },
    });
    return NextResponse.json({
      anzahl: teams.length,
      luecken: hatLuecken(teams),
      hoechsteNummer: teams.at(-1)?.nummer ?? 0,
    });
  } catch (error) {
    console.error("GET /api/teams/nummern error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Nummern" }, { status: 500 });
  }
}

/**
 * POST /api/teams/nummern – Nummern lückenlos auf 1…N setzen.
 *
 * Die bisherige Reihenfolge bleibt erhalten; nur die Lücken verschwinden, die
 * das Löschen von Teams hinterlassen hat.
 */
export async function POST() {
  const { error } = await requireRole("ORGA");
  if (error) return error;

  try {
    const teams = await prisma.team.findMany({
      select: { id: true, nummer: true },
      orderBy: { nummer: "asc" },
    });

    const aenderungen = neueNummern(teams);
    if (aenderungen.length === 0) {
      return NextResponse.json({ geaendert: 0, teams: teams.length });
    }

    await prisma.$transaction(async (tx) => {
      // Phase 1: aus dem Weg räumen
      for (const [index, team] of aenderungen.entries()) {
        await tx.team.update({
          where: { id: team.id },
          data: { nummer: PARKBEREICH + index },
        });
      }
      // Phase 2: Zielnummern setzen
      for (const team of aenderungen) {
        await tx.team.update({ where: { id: team.id }, data: { nummer: team.nummer } });
      }
    });

    return NextResponse.json({ geaendert: aenderungen.length, teams: teams.length });
  } catch (error) {
    console.error("POST /api/teams/nummern error:", error);
    return NextResponse.json(
      { error: "Die Nummern konnten nicht neu vergeben werden." },
      { status: 500 },
    );
  }
}
