import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/situationsplan/[id]/hintergrund – Lageplan-Bild fürs Team-Portal setzen/entfernen (ORGA+)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const url = body.hintergrundbildUrl;

    if (url !== null && (typeof url !== "string" || url.length > 500)) {
      return NextResponse.json(
        { error: "hintergrundbildUrl muss eine URL (max. 500 Zeichen) oder null sein" },
        { status: 400 },
      );
    }
    if (
      typeof url === "string" &&
      !url.startsWith("/api/uploads/") &&
      !url.startsWith("https://") &&
      !url.startsWith("http://")
    ) {
      return NextResponse.json({ error: "Ungültige Bild-URL" }, { status: 400 });
    }

    const plan = await prisma.situationsplan.update({
      where: { id },
      data: { hintergrundbildUrl: url },
    });
    return NextResponse.json(plan);
  } catch (error) {
    console.error(`PUT /api/situationsplan/${id}/hintergrund error:`, error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
