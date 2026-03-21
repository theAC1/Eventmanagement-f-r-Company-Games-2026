import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSchedule, type PauseInput } from "@/lib/schedule-engine";

// POST /api/schedule/generate – Zeitplan generieren (Preview, ohne DB-Speicherung)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      blockDauerMin = 15,
      wechselzeitMin = 5,
      startZeit = "09:00",
      pausen = [] as PauseInput[],
    } = body;

    // Load all active/ready games
    const games = await prisma.game.findMany({
      where: { status: { in: ["BEREIT", "AKTIV"] } },
      select: { id: true, name: true, teamsProSlot: true },
      orderBy: { name: "asc" },
    });

    // Load all teams
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, nummer: true },
      orderBy: { nummer: "asc" },
    });

    if (games.length === 0) {
      return NextResponse.json(
        { error: "Keine Games mit Status BEREIT oder AKTIV gefunden. Setze Games auf 'Bereit' in der Game-Verwaltung." },
        { status: 400 }
      );
    }

    if (teams.length === 0) {
      return NextResponse.json(
        { error: "Keine Teams vorhanden. Erstelle zuerst Teams." },
        { status: 400 }
      );
    }

    const result = generateSchedule({
      teams,
      games,
      blockDauerMin,
      wechselzeitMin,
      startZeit,
      pausen,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/schedule/generate error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Zeitplan-Generierung" },
      { status: 500 }
    );
  }
}
