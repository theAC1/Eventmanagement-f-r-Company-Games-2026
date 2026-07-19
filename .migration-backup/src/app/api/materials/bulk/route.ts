import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import {
  MaterialBulkUpdateSchema,
  MaterialBulkDeleteSchema,
  zodValidationError,
} from "@/lib/schemas";

// POST /api/materials/bulk – Patch mehrerer Material-Items
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = MaterialBulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const { ids, patch } = parsed.data;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Patch darf nicht leer sein" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();

    const result = await prisma.materialItem.updateMany({
      where: { id: { in: ids } },
      data: {
        ...patch,
        updatedById: userId,
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("POST /api/materials/bulk error:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Materialien" },
      { status: 500 }
    );
  }
}

// DELETE /api/materials/bulk – Mehrere Material-Items löschen
export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = MaterialBulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const result = await prisma.materialItem.deleteMany({
      where: { id: { in: parsed.data.ids } },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("DELETE /api/materials/bulk error:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Materialien" },
      { status: 500 }
    );
  }
}
