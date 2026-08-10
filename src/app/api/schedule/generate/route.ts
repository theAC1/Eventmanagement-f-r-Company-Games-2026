import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/lib/schedule-engine";
import { requireRole } from "@/lib/auth-helpers";
import { ZeitplanParameterSchema, zodValidationError } from "@/lib/schemas";

// Die Preview war schon immer mit leerem Body aufrufbar — Defaults ergänzen
// die Pflichtfelder des Parameter-Schemas, ohne dessen Grenzen zu lockern.
const GenerateBodySchema = ZeitplanParameterSchema.extend({
  blockDauerMin: ZeitplanParameterSchema.shape.blockDauerMin.default(15),
  wechselzeitMin: ZeitplanParameterSchema.shape.wechselzeitMin.default(5),
  startZeit: ZeitplanParameterSchema.shape.startZeit.default("09:00"),
});

// POST /api/schedule/generate – Zeitplan generieren (Preview, ohne DB-Speicherung)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    // Unvalidierte Werte (z. B. mittagspause.maxTeamsGleichzeitig = 0) würden
    // die Engine in eine Endlosschleife treiben — deshalb Zod vor der Engine.
    const body = await request.json().catch(() => null);
    const parsed = GenerateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const {
      blockDauerMin,
      wechselzeitMin,
      startZeit,
      pausen,
      mittagspause,
      antiKorrelationen,
    } = parsed.data;

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

    // Anti-Korrelations-Paare gegen die geladenen Games validieren
    const gameIds = new Set(games.map((g) => g.id));
    for (const paar of antiKorrelationen) {
      if (paar.gameXId === paar.gameYId) {
        return NextResponse.json(
          { error: "Anti-Korrelation: Game A und Game B müssen unterschiedlich sein." },
          { status: 400 }
        );
      }
      if (!gameIds.has(paar.gameXId) || !gameIds.has(paar.gameYId)) {
        return NextResponse.json(
          { error: "Anti-Korrelation verweist auf ein Game, das nicht den Status BEREIT oder AKTIV hat." },
          { status: 400 }
        );
      }
    }

    const result = generateSchedule({
      teams,
      games,
      blockDauerMin,
      wechselzeitMin,
      startZeit,
      pausen,
      mittagspause: mittagspause ?? undefined,
      antiKorrelationen,
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
