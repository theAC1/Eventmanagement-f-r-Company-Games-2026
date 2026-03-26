/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/schedule/:id – Gespeicherten Zeitplan laden (mit Slots + Teams)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const config = await prisma.zeitplanConfig.findUnique({
      where: { id },
      include: {
        slots: {
          include: {
            game: { select: { id: true, name: true, slug: true } },
            teams: {
              include: { team: { select: { id: true, name: true, nummer: true } } },
            },
          },
          orderBy: [{ runde: "asc" }, { startZeit: "asc" }],
        },
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Zeitplan nicht gefunden" }, { status: 404 });
    }

    // In SlotOutput-Format transformieren (wie generateSchedule es liefert)
    const slots = config.slots.map((s: any) => ({
      runde: s.runde,
      startZeit: s.startZeit,
      endZeit: s.endZeit,
      gameId: s.game?.id ?? "",
      gameName: s.game?.name ?? "–",
      teamIds: s.teams.map((t: any) => t.team.id),
      teamNames: s.teams.map((t: any) => t.team.name),
    }));

    // Team-Zeitpläne bauen
    const teamZeitplaene: Record<string, any[]> = {};
    const allTeamIds = new Set<string>();
    for (const s of slots) {
      for (const tid of s.teamIds) allTeamIds.add(tid);
    }
    for (const tid of allTeamIds) {
      teamZeitplaene[tid] = slots
        .filter((s: any) => s.teamIds.includes(tid))
        .sort((a: any, b: any) => a.runde - b.runde);
    }

    return NextResponse.json({
      id: config.id,
      name: config.name,
      anzahlTeams: config.anzahlTeams,
      blockDauerMin: config.blockDauerMin,
      wechselzeitMin: config.wechselzeitMin,
      startZeit: config.startZeit,
      endZeit: config.endZeit,
      pausen: config.pausen,
      mittagspause: config.mittagspause,
      istAktiv: config.istAktiv,
      createdAt: config.createdAt,
      runden: Math.max(...slots.map((s: any) => s.runde), 0),
      slots,
      teamZeitplaene,
      konflikte: [],
    });
  } catch (error) {
    console.error(`GET /api/schedule/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// PUT /api/schedule/:id – Zeitplan aktualisieren (Name, aktiv, oder Slots ersetzen)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();

    // Wenn nur Metadaten (Name, istAktiv)
    if (body.nameOnly) {
      const updated = await prisma.zeitplanConfig.update({
        where: { id },
        data: {
          name: body.name,
          istAktiv: body.istAktiv,
        },
      });
      return NextResponse.json(updated);
    }

    // Wenn auch istAktiv gesetzt wird → alle anderen deaktivieren
    if (body.istAktiv) {
      await prisma.zeitplanConfig.updateMany({
        where: { id: { not: id } },
        data: { istAktiv: false },
      });
    }

    // Komplett-Update: Alte Slots löschen, neue erstellen
    const { name, blockDauerMin, wechselzeitMin, startZeit, endZeit, mittagspause, pausen, slots, istAktiv } = body;

    await prisma.zeitplanSlot.deleteMany({ where: { configId: id } });

    const teamIds = new Set<string>();
    for (const slot of slots) {
      for (const tid of slot.teamIds) teamIds.add(tid);
    }

    const updated = await prisma.zeitplanConfig.update({
      where: { id },
      data: {
        name,
        anzahlTeams: teamIds.size,
        blockDauerMin,
        wechselzeitMin,
        startZeit,
        endZeit,
        pausen: pausen ?? [],
        mittagspause: mittagspause ?? null,
        istAktiv: istAktiv ?? false,
        slots: {
          create: slots.map((slot: { runde: number; startZeit: string; endZeit: string; gameId: string; teamIds: string[] }) => ({
            runde: slot.runde,
            startZeit: slot.startZeit,
            endZeit: slot.endZeit,
            gameId: slot.gameId,
            teams: {
              create: slot.teamIds.map((teamId: string) => ({ teamId })),
            },
          })),
        },
      },
      include: { _count: { select: { slots: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`PUT /api/schedule/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

// DELETE /api/schedule/:id
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    await prisma.zeitplanConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/schedule/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
