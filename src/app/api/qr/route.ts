import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// POST /api/qr – QR-Token verifizieren (Schiedsrichter scannt Team-Badge)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
    const body = await request.json();
    const { qrToken } = body;

    if (!qrToken) {
      return NextResponse.json({ error: "QR-Token fehlt" }, { status: 400 });
    }

    const team = await prisma.team.findUnique({
      where: { qrToken },
      select: { id: true, name: true, nummer: true },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Ungültiger QR-Code", verified: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      verified: true,
      teamId: team.id,
      teamName: team.name,
      teamNummer: team.nummer,
    });
  } catch (error) {
    console.error("POST /api/qr error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
