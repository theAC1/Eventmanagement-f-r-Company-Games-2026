import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { PersonRolle } from "@prisma/client";

// GET /api/persons – schlanke Personen-Liste für Selektoren (Verantwortliche etc.)
// ORGA-Zugriff (im Gegensatz zu /api/users → ADMIN), exposed nur id/name/rolle.
// Optional: ?rolle=SCHIEDSRICHTER,HELFER filtert auf bestimmte Rollen.
export async function GET(request: NextRequest) {
  const { error } = await requireRole("ORGA");
  if (error) return error;

  const rolleParam = request.nextUrl.searchParams.get("rolle");
  const rollen = (rolleParam ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is PersonRolle => r in PersonRolle);

  const persons = await prisma.person.findMany({
    where: {
      istAktiv: true,
      ...(rollen.length > 0 ? { rolle: { in: rollen } } : {}),
    },
    select: { id: true, name: true, rolle: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(persons);
}
