import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { KvpStatusUpdateSchema, zodValidationError } from "@/lib/schemas";

// PATCH /api/kvp/[id] – Status ändern (nur ADMIN)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireRole("ADMIN");
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = KvpStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const eintrag = await prisma.kvpEintrag.update({
      where: { id },
      data: { status: parsed.data.status },
      include: {
        eingetragenVon: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(eintrag);
  } catch (error) {
    console.error("PATCH /api/kvp/[id] error:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des KVP-Eintrags" },
      { status: 500 }
    );
  }
}

// DELETE /api/kvp/[id] – Eintrag löschen (nur ADMIN)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireRole("ADMIN");
  if (authError) return authError;

  try {
    const { id } = await params;
    await prisma.kvpEintrag.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/kvp/[id] error:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des KVP-Eintrags" },
      { status: 500 }
    );
  }
}
