import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import { MaterialUpdateSchema, zodValidationError } from "@/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/materials/:id
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const item = await prisma.materialItem.findUnique({
      where: { id },
      include: {
        game: { select: { id: true, name: true, slug: true } },
        verantwortlich: { select: { id: true, name: true } },
        kommentare: {
          include: { autor: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Material nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error(`GET /api/materials/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Materials" },
      { status: 500 }
    );
  }
}

// PUT /api/materials/:id
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = MaterialUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const userId = await getCurrentUserId();

    const item = await prisma.materialItem.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedById: userId,
      },
      include: {
        game: { select: { id: true, name: true, slug: true } },
        verantwortlich: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error(`PUT /api/materials/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Materials" },
      { status: 500 }
    );
  }
}

// DELETE /api/materials/:id
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    await prisma.materialItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/materials/${id} error:`, error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Materials" },
      { status: 500 }
    );
  }
}
