import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

// GET /api/persons – schlanke Personen-Liste für Selektoren (Verantwortliche etc.)
// ORGA-Zugriff (im Gegensatz zu /api/users → ADMIN), exposed nur id/name/rolle.
export async function GET() {
  const { error } = await requireRole("ORGA");
  if (error) return error;

  const persons = await prisma.person.findMany({
    where: { istAktiv: true },
    select: { id: true, name: true, rolle: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(persons);
}
