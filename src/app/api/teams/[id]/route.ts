import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import { TeamUpdateSchema, zodValidationError } from "@/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/teams/:id
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        ergebnisse: {
          include: { game: { select: { name: true } } },
          orderBy: { game: { name: "asc" } },
        },
      },
    });
    if (!team) return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    return NextResponse.json(team);
  } catch (error) {
    console.error(`GET /api/teams/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Laden des Teams" }, { status: 500 });
  }
}

// PUT /api/teams/:id
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = TeamUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const userId = await getCurrentUserId();

    const team = await prisma.team.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedById: userId,
      },
    });
    return NextResponse.json(team);
  } catch (error) {
    console.error(`PUT /api/teams/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren des Teams" }, { status: 500 });
  }
}

// DELETE /api/teams/:id
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    await prisma.team.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/teams/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Löschen des Teams" }, { status: 500 });
  }
}
