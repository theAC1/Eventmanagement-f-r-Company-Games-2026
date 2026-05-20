import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import { KvpCreateSchema, zodValidationError } from "@/lib/schemas";

// POST /api/kvp – Neuen KVP-Eintrag erstellen (ORGA+)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = KvpCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const userId = await getCurrentUserId();
    const { typ, titel, beschreibung, seite } = parsed.data;

    const eintrag = await prisma.kvpEintrag.create({
      data: {
        typ,
        titel,
        beschreibung,
        seite: seite ?? null,
        eingetragenVonId: userId,
      },
      include: {
        eingetragenVon: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(eintrag, { status: 201 });
  } catch (error) {
    console.error("POST /api/kvp error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des KVP-Eintrags" },
      { status: 500 }
    );
  }
}

// GET /api/kvp – Alle KVP-Einträge (nur ADMIN)
export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole("ADMIN");
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const typ = searchParams.get("typ");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (typ) where.typ = typ;

    const eintraege = await prisma.kvpEintrag.findMany({
      where,
      include: {
        eingetragenVon: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(eintraege);
  } catch (error) {
    console.error("GET /api/kvp error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der KVP-Einträge" },
      { status: 500 }
    );
  }
}
