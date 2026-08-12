import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { ZeitplanSaveSchema, zodValidationError } from "@/lib/schemas";
import { getGamedayModus } from "@/lib/zeitplan-config";
import { pruefeGamedaySperre } from "@/lib/zeitplan-sperre";
import { normalisiereMittagsfenster } from "@/lib/mittagsplanung";

/** Listenfelder: genug, um Parameter eines Plans ohne Nachladen anzuzeigen. */
const LIST_SELECT = {
  id: true,
  name: true,
  anzahlTeams: true,
  blockDauerMin: true,
  wechselzeitMin: true,
  startZeit: true,
  endZeit: true,
  fensterEndeZeit: true,
  postenVormittag: true,
  pausen: true,
  mittagspause: true,
  mittagswellen: true,
  istAktiv: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { slots: true } },
} as const;

// GET /api/schedule – Alle gespeicherten Zeitpläne inkl. Parameter
export async function GET() {
  const { error: authError } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
    const configs = await prisma.zeitplanConfig.findMany({
      select: LIST_SELECT,
      orderBy: [{ istAktiv: "desc" }, { createdAt: "desc" }],
    });
    // Pläne aus der Zeit der festen Mittagspause tragen noch die alte Form.
    return NextResponse.json(
      configs.map((c) => ({
        ...c,
        mittagspause: normalisiereMittagsfenster(c.mittagspause),
      })),
    );
  } catch (error) {
    console.error("GET /api/schedule error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST /api/schedule – Zeitplan speichern (Config + Slots)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  try {
    const parsed = ZeitplanSaveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const {
      name,
      blockDauerMin,
      wechselzeitMin,
      startZeit,
      endZeit,
      fensterEndeZeit,
      postenVormittag,
      mittagsfenster,
      mittagswellen,
      pausen,
      slots,
      istAktiv,
    } = parsed.data;

    // POST legt immer einen NEUEN Plan an (Ersetzen läuft über PUT /:id).
    // Ein neuer, inaktiver Entwurfsplan berührt keine bestehenden Slot-IDs —
    // die Gameday-Sperre greift hier nur, wenn der Plan sofort aktiv werden
    // soll und damit den laufenden Tag umhängen würde.
    if (istAktiv) {
      const sperre = pruefeGamedaySperre(await getGamedayModus(), "AKTIVIERUNG");
      if (!sperre.erlaubt) {
        return NextResponse.json({ error: sperre.grund }, { status: 409 });
      }
    }

    // Anzahl Teams aus den Slots ableiten
    const teamIds = new Set<string>();
    for (const slot of slots) {
      for (const tid of slot.teamIds) teamIds.add(tid);
    }

    const config = await prisma.$transaction(async (tx) => {
      if (istAktiv) {
        await tx.zeitplanConfig.updateMany({ data: { istAktiv: false } });
      }

      return tx.zeitplanConfig.create({
        data: {
          name,
          anzahlTeams: teamIds.size,
          blockDauerMin,
          wechselzeitMin,
          startZeit,
          endZeit,
          fensterEndeZeit: fensterEndeZeit ?? null,
          postenVormittag: postenVormittag ?? null,
          pausen,
          mittagspause: mittagsfenster ?? Prisma.DbNull,
          mittagswellen,
          istAktiv: istAktiv ?? false,
          slots: {
            create: slots.map((slot) => ({
              runde: slot.runde,
              startZeit: slot.startZeit,
              endZeit: slot.endZeit,
              gameId: slot.gameId,
              teams: {
                create: slot.teamIds.map((teamId) => ({ teamId })),
              },
            })),
          },
        },
        select: LIST_SELECT,
      });
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/schedule error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
