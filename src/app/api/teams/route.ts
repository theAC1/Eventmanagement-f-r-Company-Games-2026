import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/teams
export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { nummer: "asc" },
    });
    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET /api/teams error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// POST /api/teams
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const team = await prisma.team.create({
      data: {
        name: body.name,
        nummer: body.nummer,
        captainName: body.captainName || null,
        captainEmail: body.captainEmail || null,
        farbe: body.farbe || "#6b7280",
        logoUrl: body.logoUrl || null,
        motto: body.motto || null,
        teilnehmerAnzahl: body.teilnehmerAnzahl || null,
        teilnehmerNamen: body.teilnehmerNamen || null,
      },
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("POST /api/teams error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
