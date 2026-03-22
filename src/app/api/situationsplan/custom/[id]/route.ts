import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/situationsplan/custom/:id
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const feld = await prisma.customFeld.update({
      where: { id },
      data: {
        label: body.label,
        nummer: body.nummer,
        farbe: body.farbe,
        breiteM: body.breiteM,
        laengeM: body.laengeM,
        x: body.x,
        y: body.y,
        rotation: body.rotation ?? 0,
        oeffentlich: body.oeffentlich,
      },
    });
    return NextResponse.json(feld);
  } catch (error) {
    console.error(`PUT custom/${id} error:`, error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// DELETE /api/situationsplan/custom/:id
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    await prisma.customFeld.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE custom/${id} error:`, error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
