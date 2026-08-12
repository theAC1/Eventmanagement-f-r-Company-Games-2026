import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUserId } from "@/lib/auth-helpers";
import { TeamUpdateSchema, zodValidationError } from "@/lib/schemas";
import { loeschFolgen, pruefeLoeschen } from "@/lib/loesch-schutz";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/teams/:id
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

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

    // Startnummern sind eindeutig. Ohne diese Prüfung liefe der Wechsel auf
    // eine belegte Nummer in einen Datenbankfehler und käme als "Fehler beim
    // Aktualisieren" zurück — ohne zu sagen, wer die Nummer hat.
    if (parsed.data.nummer !== undefined) {
      const belegt = await prisma.team.findUnique({
        where: { nummer: parsed.data.nummer },
        select: { id: true, name: true },
      });
      if (belegt && belegt.id !== id) {
        return NextResponse.json(
          {
            error: `Startnummer ${parsed.data.nummer} ist bereits an "${belegt.name}" vergeben.`,
          },
          { status: 409 },
        );
      }
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

/**
 * DELETE /api/teams/:id
 *
 * Zeitplan-Einsätze und QR-Scans räumt die Datenbank per Cascade mit weg —
 * sie sind Planungsdaten. Erfasste Ergebnisse blockieren dagegen: sie sind der
 * Wertungsstand und dürfen nicht beiläufig verschwinden.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const team = await prisma.team.findUnique({
      where: { id },
      select: {
        name: true,
        _count: { select: { ergebnisse: true, slotTeams: true, qrScans: true } },
      },
    });
    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    const entscheid = pruefeLoeschen(
      `Team "${team.name}"`,
      [{ was: "erfasste Ergebnisse", anzahl: team._count.ergebnisse }],
      "Lösche zuerst die Ergebnisse oder setze den Gameday zurück.",
    );
    if (!entscheid.erlaubt) {
      return NextResponse.json({ error: entscheid.grund }, { status: 409 });
    }

    await prisma.team.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      folgen: loeschFolgen([
        { was: "Zeitplan-Einsätze", anzahl: team._count.slotTeams },
        { was: "QR-Verifikationen", anzahl: team._count.qrScans },
      ]),
    });
  } catch (error) {
    console.error(`DELETE /api/teams/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Löschen des Teams" }, { status: 500 });
  }
}
