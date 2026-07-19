import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { generateTeamsCSV } from "@/lib/export";

export async function GET() {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const teams = await prisma.team.findMany({
      select: {
        nummer: true,
        name: true,
        captainName: true,
        captainEmail: true,
        farbe: true,
        teilnehmerAnzahl: true,
        motto: true,
      },
      orderBy: { nummer: "asc" },
    });

    const csv = generateTeamsCSV(teams);
    const datum = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="teams-${datum}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/teams error:", error);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
