import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { getFeldNummern } from "@/lib/feld-info";

// GET /api/zeitplan-slots/[slotId] – Slot-Zeiten für den Referee-Timer (SCHIEDSRICHTER+)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> },
) {
  const { error: authError } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  const { slotId } = await params;

  try {
    const slot = await prisma.zeitplanSlot.findUnique({
      where: { id: slotId },
      select: {
        id: true,
        startZeit: true,
        endZeit: true,
        runde: true,
        status: true,
        gameId: true,
        // Erwartete Teams: Der Schiedsrichter muss VOR dem Check-in wissen,
        // wer bei ihm antreten sollte — sonst ist die Begegnung für ihn
        // anonym und er kann nur raten, ob die richtigen Leute vor ihm stehen.
        teams: {
          select: {
            team: { select: { id: true, name: true, nummer: true, farbe: true } },
          },
        },
      },
    });

    if (!slot) {
      return NextResponse.json({ error: "Slot nicht gefunden" }, { status: 404 });
    }

    const feldNummern = slot.gameId
      ? await getFeldNummern([slot.gameId])
      : new Map<string, string>();

    return NextResponse.json({
      slotId: slot.id,
      startZeit: slot.startZeit,
      endZeit: slot.endZeit,
      runde: slot.runde,
      status: slot.status,
      feld: slot.gameId ? (feldNummern.get(slot.gameId) ?? null) : null,
      teams: slot.teams.map((t) => t.team),
    });
  } catch (error) {
    console.error(`GET /api/zeitplan-slots/${slotId} error:`, error);
    return NextResponse.json({ error: "Fehler beim Laden des Slots" }, { status: 500 });
  }
}
