import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const team = await prisma.team.findUnique({
    where: { qrToken: token },
    select: { id: true, name: true, nummer: true, farbe: true, logoUrl: true },
  });

  if (!team) {
    return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({
    teamId: team.id,
    teamName: team.name,
    teamNummer: team.nummer,
    teamFarbe: team.farbe,
    teamLogo: team.logoUrl,
  });
}
