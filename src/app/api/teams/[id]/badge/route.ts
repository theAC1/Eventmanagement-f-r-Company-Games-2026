import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/teams/:id/badge – QR-Code-Daten für Badge-Generierung
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const team = await prisma.team.findUnique({
      where: { id },
      select: { id: true, name: true, nummer: true, qrToken: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "https://games.arvuna.ch";
    const portalUrl = `${baseUrl}/team/${team.qrToken}`;

    return NextResponse.json({
      teamId: team.id,
      teamName: team.name,
      teamNummer: team.nummer,
      qrToken: team.qrToken,
      portalUrl,
    });
  } catch (error) {
    console.error(`GET /api/teams/${id}/badge error:`, error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
