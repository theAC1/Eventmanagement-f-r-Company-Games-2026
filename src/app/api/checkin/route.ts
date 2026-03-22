import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/checkin – Team per QR-Token oder Check-in-Code identifizieren
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrToken, checkinCode } = body;

    if (!qrToken && !checkinCode) {
      return NextResponse.json({ error: "QR-Token oder Check-in-Code erforderlich" }, { status: 400 });
    }

    let team;
    if (checkinCode) {
      // 3-Zeichen Code Lookup
      team = await prisma.team.findUnique({
        where: { checkinCode: checkinCode.toUpperCase().trim() },
        select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
      });
    } else {
      // QR-Token Lookup (der checkin-spezifische Teil der URL)
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
