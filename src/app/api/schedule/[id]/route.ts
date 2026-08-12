import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import {
  ZeitplanPatchSchema,
  ZeitplanSaveSchema,
  zodValidationError,
} from "@/lib/schemas";
import {
  getGamedayModus,
  getZeitplanAbhaengigkeiten,
} from "@/lib/zeitplan-config";
import {
  pruefeGamedaySperre,
  pruefeNeuaufbau,
  warnungen,
} from "@/lib/zeitplan-sperre";
import { pruefeZeitplanKonflikte } from "@/lib/zeitplan-konflikte";
import {
  durchgaengeAusSlots,
  pruefeZeitplanAktualitaet,
} from "@/lib/zeitplan-aktualitaet";
import { ladeAktuellenStand, ladeSollDurchgaenge } from "@/lib/zeitplan-eingaben";

type RouteParams = { params: Promise<{ id: string }> };

type DbSlot = {
  id: string;
  runde: number;
  startZeit: string;
  endZeit: string;
  status: string;
  game: { id: string; name: string; slug: string } | null;
  teams: Array<{ team: { id: string; name: string; nummer: number } }>;
};

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

// GET /api/schedule/:id – Gespeicherten Zeitplan laden (mit Slots + Teams)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

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

    const slots = config.slots.map((s: DbSlot) => ({
      slotId: s.id,
      status: s.status,
      runde: s.runde,
      startZeit: s.startZeit,
      endZeit: s.endZeit,
      gameId: s.game?.id ?? "",
      gameName: s.game?.name ?? "–",
      gameSlug: s.game?.slug ?? "",
      teamIds: s.teams.map((t) => t.team.id),
      teamNames: s.teams.map((t) => t.team.name),
    }));

    const teamZeitplaene: Record<string, typeof slots> = {};
    const allTeamIds = new Set<string>();
    for (const s of slots) {
      for (const tid of s.teamIds) allTeamIds.add(tid);
    }
    for (const tid of allTeamIds) {
      teamZeitplaene[tid] = slots
        .filter((s) => s.teamIds.includes(tid))
        .sort((a, b) => a.runde - b.runde);
    }

    // Sperr-Status mitliefern, damit die UI Buttons korrekt deaktiviert
    const [abhaengigkeiten, gamedayModus, sollDurchgaenge, stammdaten] =
      await Promise.all([
        getZeitplanAbhaengigkeiten(id),
        getGamedayModus(),
        ladeSollDurchgaenge(),
        ladeAktuellenStand(),
      ]);
    const neuaufbau = pruefeNeuaufbau(gamedayModus, abhaengigkeiten);

    // Passt der gespeicherte Plan noch zu den heutigen Teams und Posten?
    const aktualitaet = pruefeZeitplanAktualitaet(
      {
        teamIds: Object.keys(teamZeitplaene),
        durchgaengeProGame: durchgaengeAusSlots(slots),
      },
      stammdaten,
    );

    return NextResponse.json({
      id: config.id,
      name: config.name,
      anzahlTeams: config.anzahlTeams,
      blockDauerMin: config.blockDauerMin,
      wechselzeitMin: config.wechselzeitMin,
      startZeit: config.startZeit,
      endZeit: config.endZeit,
      fensterEndeZeit: config.fensterEndeZeit,
      postenVormittag: config.postenVormittag,
      pausen: config.pausen,
      mittagsfenster: config.mittagspause,
      mittagsWellen: config.mittagswellen,
      istAktiv: config.istAktiv,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      runden: Math.max(...slots.map((s) => s.runde), 0),
      slots,
      teamZeitplaene,
      // Aus den gespeicherten Slots neu geprüft — sonst meldete jeder geladene
      // Zeitplan "0 Konflikte", unabhängig von seinem tatsächlichen Zustand.
      konflikte: pruefeZeitplanKonflikte(slots, sollDurchgaenge),
      abhaengigkeiten,
      aktualitaet,
      sperre: {
        gamedayModus,
        neuaufbauErlaubt: neuaufbau.erlaubt,
        grund: neuaufbau.grund,
        warnungen: warnungen(abhaengigkeiten),
      },
    });
  } catch (error) {
    console.error(`GET /api/schedule/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

/**
 * PUT /api/schedule/:id
 *
 * Zwei Modi, unterschieden am Feld `slots`:
 * - mit `slots`  → vollständiger Neuaufbau (Parameter + Slots ersetzen)
 * - ohne `slots` → nur Metadaten (umbenennen / aktiv setzen)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireRole("ORGA");
  if (authError) return authError;

  const { id } = await params;
  try {
    const body = await request.json();
    const gamedayModus = await getGamedayModus();

    const exists = await prisma.zeitplanConfig.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Zeitplan nicht gefunden" }, { status: 404 });
    }

    // ── Metadaten-Patch (kein Slot-Neuaufbau) ──
    if (body.slots === undefined) {
      const parsed = ZeitplanPatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
      }
      const { name, istAktiv } = parsed.data;

      if (istAktiv !== undefined) {
        const sperre = pruefeGamedaySperre(gamedayModus, "AKTIVIERUNG");
        if (!sperre.erlaubt) {
          return NextResponse.json({ error: sperre.grund }, { status: 409 });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Genau ein Zeitplan darf aktiv sein — sonst greift der Leitstand
        // auf einen zufälligen zu.
        if (istAktiv === true) {
          await tx.zeitplanConfig.updateMany({
            where: { id: { not: id } },
            data: { istAktiv: false },
          });
        }
        return tx.zeitplanConfig.update({
          where: { id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(istAktiv !== undefined ? { istAktiv } : {}),
          },
          select: LIST_SELECT,
        });
      });

      return NextResponse.json(updated);
    }

    // ── Vollständiger Neuaufbau ──
    const parsed = ZeitplanSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const abhaengigkeiten = await getZeitplanAbhaengigkeiten(id);
    const erlaubt = pruefeNeuaufbau(gamedayModus, abhaengigkeiten);
    if (!erlaubt.erlaubt) {
      return NextResponse.json({ error: erlaubt.grund }, { status: 409 });
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

    const teamIds = new Set<string>();
    for (const slot of slots) {
      for (const tid of slot.teamIds) teamIds.add(tid);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (istAktiv === true) {
        await tx.zeitplanConfig.updateMany({
          where: { id: { not: id } },
          data: { istAktiv: false },
        });
      }

      await tx.zeitplanSlot.deleteMany({ where: { configId: id } });

      return tx.zeitplanConfig.update({
        where: { id },
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
          ...(istAktiv !== undefined ? { istAktiv } : {}),
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

    return NextResponse.json({
      ...updated,
      verworfeneEinsaetze: abhaengigkeiten.einsaetze,
    });
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
    const sperre = pruefeGamedaySperre(await getGamedayModus(), "LOESCHEN");
    if (!sperre.erlaubt) {
      return NextResponse.json({ error: sperre.grund }, { status: 409 });
    }

    const abhaengigkeiten = await getZeitplanAbhaengigkeiten(id);
    if (abhaengigkeiten.qrScans > 0 || abhaengigkeiten.ergebnisse > 0) {
      return NextResponse.json(
        {
          error:
            "Am Zeitplan hängen bereits Ergebnisse oder QR-Verifikationen — er kann nicht gelöscht werden.",
        },
        { status: 409 },
      );
    }

    await prisma.zeitplanConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/schedule/${id} error:`, error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
