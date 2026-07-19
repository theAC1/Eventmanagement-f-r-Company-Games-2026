/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

const GAME_INCLUDE = {
  gamePositionen: {
    include: {
      game: { select: { id: true, name: true, slug: true, modus: true, flaecheLaengeM: true, flaecheBreiteM: true, helferAnzahl: true, stromNoetig: true } },
    },
  },
  infrastruktur: true,
  customFelder: true,
};

// GET /api/situationsplan
export async function GET() {
  try {
    let plan = await prisma.situationsplan.findFirst({
      where: { istAktiv: true },
      include: GAME_INCLUDE,
    });

    if (!plan) {
      plan = await prisma.situationsplan.create({
        data: { name: "Hauptplan", istAktiv: true },
        include: GAME_INCLUDE,
      });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/situationsplan error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// PUT /api/situationsplan – Game-Position upsert
export async function PUT(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();
    const { planId, gameId, x, y, nummer, oeffentlich } = body;

    if (!planId || !gameId) {
      return NextResponse.json({ error: "planId und gameId erforderlich" }, { status: 400 });
    }

    const existing = await prisma.gamePosition.findFirst({ where: { planId, gameId } });

    let position;
    if (existing) {
      const data: any = {};
      if (x !== undefined) data.x = x;
      if (y !== undefined) data.y = y;
      if (nummer !== undefined) data.nummer = nummer;
      if (oeffentlich !== undefined) data.oeffentlich = oeffentlich;
      position = await prisma.gamePosition.update({ where: { id: existing.id }, data });
    } else {
      position = await prisma.gamePosition.create({
        data: { planId, gameId, x, y, rotation: 0, nummer: nummer ?? "", oeffentlich: oeffentlich ?? true },
      });
    }

    return NextResponse.json(position);
  } catch (error) {
    console.error("PUT /api/situationsplan error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// POST /api/situationsplan – Infrastruktur oder Custom-Feld
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const body = await request.json();

    if (body.type === "custom") {
      const feld = await prisma.customFeld.create({
        data: {
          planId: body.planId,
          label: body.label ?? "Neues Feld",
          nummer: body.nummer ?? "",
          farbe: body.farbe ?? "#6b7280",
          breiteM: body.breiteM ?? 10,
          laengeM: body.laengeM ?? 10,
          x: body.x ?? 50,
          y: body.y ?? 50,
          oeffentlich: body.oeffentlich ?? true,
        },
      });
      return NextResponse.json(feld, { status: 201 });
    }

    const element = await prisma.infrastrukturElement.create({
      data: { planId: body.planId, typ: body.typ, label: body.label ?? null, x: body.x, y: body.y },
    });
    return NextResponse.json(element, { status: 201 });
  } catch (error) {
    console.error("POST /api/situationsplan error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
