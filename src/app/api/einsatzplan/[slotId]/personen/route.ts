import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { getCurrentZeitplanConfig } from "@/lib/zeitplan-config";
import { EinsatzplanPersonenSchema, zodValidationError } from "@/lib/schemas";

// PUT /api/einsatzplan/[slotId]/personen – Zuweisung setzen/ersetzen (ORGA+)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { slotId } = await params;
  try {
    const body = await request.json();
    const parsed = EinsatzplanPersonenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }
    const uniqueIds = [...new Set(parsed.data.personIds)];

    const slot = await prisma.zeitplanSlot.findUnique({
      where: { id: slotId },
      select: { id: true, configId: true },
    });
    if (!slot) {
      return NextResponse.json({ error: "Slot nicht gefunden" }, { status: 404 });
    }

    const config = await getCurrentZeitplanConfig();
    if (!config || slot.configId !== config.id) {
      return NextResponse.json(
        { error: "Slot gehört nicht zum aktuellen Zeitplan — Zuweisung nicht möglich" },
        { status: 400 }
      );
    }

    const personen = await prisma.person.findMany({
      where: { id: { in: uniqueIds }, istAktiv: true },
      select: { id: true, rolle: true },
    });
    if (personen.length !== uniqueIds.length) {
      return NextResponse.json(
        { error: "Eine oder mehrere Personen wurden nicht gefunden oder sind inaktiv" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.zeitplanSlotPerson.deleteMany({ where: { slotId } }),
      prisma.zeitplanSlotPerson.createMany({
        data: personen.map((p) => ({ slotId, personId: p.id, rolle: p.rolle })),
      }),
    ]);

    const updated = await prisma.zeitplanSlot.findUnique({
      where: { id: slotId },
      include: {
        personen: { include: { person: { select: { id: true, name: true, rolle: true } } } },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`PUT /api/einsatzplan/${slotId}/personen error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Zuweisung" },
      { status: 500 }
    );
  }
}
