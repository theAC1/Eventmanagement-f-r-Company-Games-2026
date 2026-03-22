import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// DELETE /api/situationsplan/infra/:id – Infrastruktur-Element löschen
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    await prisma.infrastrukturElement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/situationsplan/infra/${id} error:`, error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
