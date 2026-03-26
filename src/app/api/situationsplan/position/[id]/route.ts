import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/situationsplan/position/:id – Position + Rotation aktualisieren
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const position = await prisma.gamePosition.update({
      where: { id },
      data: {
        x: body.x,
        y: body.y,
        rotation: body.rotation ?? 0,
      },
    });
    return NextResponse.json(position);
  } catch (error) {
    console.error(`PUT /api/situationsplan/position/${id} error:`, error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// DELETE /api/situationsplan/position/:id – Game-Position entfernen
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    await prisma.gamePosition.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/situationsplan/position/${id} error:`, error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
