import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueCheckinCode } from "@/lib/checkin-code";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import { TeamCreateSchema, zodValidationError } from "@/lib/schemas";

// GET /api/teams
export async function GET() {
  try {
    const teams = await prisma.team.findMany({ orderBy: { nummer: "asc" } });
    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET /api/teams error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Teams" }, { status: 500 });
  }
}

// POST /api/teams
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = TeamCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const data = parsed.data;

    // Existierende Codes laden für Uniqueness
    const existing = await prisma.team.findMany({ select: { checkinCode: true } });
    const existingCodes = new Set<string>(existing.map((t: { checkinCode: string }) => t.checkinCode).filter(Boolean));
    const checkinCode = generateUniqueCheckinCode(existingCodes);

    const userId = await getCurrentUserId();

    const team = await prisma.team.create({
      data: {
        name: data.name,
        nummer: data.nummer,
        captainName: data.captainName || null,
        captainEmail: data.captainEmail || null,
        farbe: data.farbe || "#6b7280",
        logoUrl: data.logoUrl || null,
        motto: data.motto || null,
        teilnehmerAnzahl: data.teilnehmerAnzahl || null,
        teilnehmerNamen: data.teilnehmerNamen || null,
        checkinCode,
        createdById: userId,
      },
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("POST /api/teams error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen des Teams" }, { status: 500 });
  }
}
