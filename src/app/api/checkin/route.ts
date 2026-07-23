import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { hasMinRole } from "@/lib/roles";

// POST /api/checkin – Team per QR-Token oder Check-in-Code identifizieren
export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;
  const user = session!.user;

  try {
    const body = await request.json();
    const { qrToken, checkinCode, slotId } = body;

    if (!qrToken && !checkinCode) {
      return NextResponse.json({ error: "QR-Token oder Check-in-Code erforderlich" }, { status: 400 });
    }

    // Slot-Guard: Schiedsrichter dürfen nur für ihnen zugewiesene Slots einchecken
    let slot: { id: string; teams: { teamId: string }[] } | null = null;
    if (slotId) {
      const found = await prisma.zeitplanSlot.findUnique({
        where: { id: String(slotId) },
        select: {
          id: true,
          schiedsrichterId: true,
          teams: { select: { teamId: true } },
          personen: { select: { personId: true } },
        },
      });
      if (!found) {
        return NextResponse.json({ error: "Slot nicht gefunden" }, { status: 404 });
      }
      const isOrga = hasMinRole(user.rolle, "ORGA");
      const assigned =
        found.schiedsrichterId === user.id ||
        found.personen.some((p) => p.personId === user.id);
      if (!isOrga && !assigned) {
        return NextResponse.json(
          { error: "Du bist diesem Slot nicht zugewiesen" },
          { status: 403 }
        );
      }
      slot = { id: found.id, teams: found.teams };
    }

    let team;
    if (checkinCode) {
      team = await prisma.team.findFirst({
        where: { checkinCode: checkinCode.toUpperCase().trim() },
        select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
      });
    } else {
      team = await prisma.team.findUnique({
        where: { qrToken },
        select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
      });
    }

    if (!team) {
      return NextResponse.json(
        { error: "Team nicht gefunden", verified: false },
        { status: 404 }
      );
    }

    // Slot-Guard: Team muss zur Begegnung gehören
    if (slot && slot.teams.length > 0 && !slot.teams.some((t) => t.teamId === team.id)) {
      return NextResponse.json(
        { error: "Dieses Team gehört nicht zu dieser Begegnung", verified: false },
        { status: 409 }
      );
    }

    return NextResponse.json({
      verified: true,
      teamId: team.id,
      teamName: team.name,
      teamNummer: team.nummer,
      teamFarbe: team.farbe,
      teamLogo: team.logoUrl,
    });
  } catch (error) {
    console.error("POST /api/checkin error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
