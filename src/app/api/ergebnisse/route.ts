import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { hasMinRole } from "@/lib/roles";
import { ErgebnisCreateSchema, zodValidationError } from "@/lib/schemas";
import { berechneGamePunkteAusRohdaten, updateGameRaenge } from "@/lib/game-punkte";
import { validiereRohdaten } from "@/lib/rohdaten-validierung";
import { istGesperrt } from "@/lib/ergebnis-sperre";
import { Prisma } from "@prisma/client";
import {
  sanitizeWertungslogikFuerSchiedsrichter,
  type Wertungslogik,
} from "@/lib/wertungslogik-types";

// Sperrfrist abgelaufen: Schiedsrichter darf nicht mehr selbst korrigieren
class LockedError extends Error {
  lockedAt: Date | null;
  constructor(lockedAt: Date | null) {
    super("Korrekturfrist abgelaufen");
    this.name = "LockedError";
    this.lockedAt = lockedAt;
  }
}

/**
 * Ein anderer Schiedsrichter hat für dieses Team bereits erfasst.
 *
 * Ohne diese Prüfung gewinnt stillschweigend, wer zuletzt speichert: Sind zwei
 * Personen demselben Slot zugeteilt (Schiri + Helfer), sehen beide dieselbe
 * Begegnung, beide zählen, beide speichern — und einer der beiden Werte
 * verschwindet, ohne dass irgendwer eine Meldung bekommt. Die Duell-Route
 * kennt diesen Schutz bereits; der Haupt-Erfassungsweg hatte ihn nicht.
 */
class ConflictError extends Error {
  bestehend: { erfasstVon: string | null; erfasstUm: Date | null; teamName: string | null };
  constructor(erfasstVon: string | null, erfasstUm: Date | null, teamName: string | null) {
    super("Bereits von jemand anderem erfasst");
    this.name = "ConflictError";
    this.bestehend = { erfasstVon, erfasstUm, teamName };
  }
}

// Vertrauliche Gewichtungs-Keys (gewichtungG/gewichtungSieg) aus dem
// eingebetteten Game strippen — Schiedsrichter sehen die Gewichtung nicht
function sanitizeErgebnisRows<T extends { game: { wertungslogik: unknown } }>(
  rows: T[],
): T[] {
  return rows.map((e) => ({
    ...e,
    game: {
      ...e.game,
      wertungslogik: sanitizeWertungslogikFuerSchiedsrichter(
        e.game.wertungslogik as Wertungslogik | null,
      ),
    },
  }));
}

// GET /api/ergebnisse
export async function GET(request: NextRequest) {
  // Immer authentifiziert: das Team-Portal nutzt /api/team/[token], nicht diese
  // Liste — ein öffentlicher ?teamId-Zweig würde die Wertungslogik leaken.
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  const istOrga = hasMinRole(session?.user?.rolle ?? "", "ORGA");
  const { searchParams } = new URL(request.url);

  try {
    const activity = searchParams.get("activity") === "true";
    const gameId = searchParams.get("gameId");
    const teamId = searchParams.get("teamId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));

    const where: Record<string, unknown> = {};
    if (gameId) where.gameId = gameId;
    if (teamId) where.teamId = teamId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { game: { name: { contains: search, mode: "insensitive" } } },
        { team: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (activity) {
      const [data, total] = await Promise.all([
        prisma.ergebnis.findMany({
          where: where as Prisma.ErgebnisWhereInput,
          include: {
            game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
            team: { select: { id: true, name: true, nummer: true } },
            eingetragenVon: { select: { id: true, name: true } },
          },
          orderBy: { eingetragenUm: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.ergebnis.count({ where: where as Prisma.ErgebnisWhereInput }),
      ]);

      return NextResponse.json({
        data: istOrga ? data : sanitizeErgebnisRows(data),
        total,
        page,
        limit,
      });
    }

    const ergebnisse = await prisma.ergebnis.findMany({
      where,
      include: {
        game: { select: { id: true, name: true, slug: true, wertungslogik: true } },
        team: { select: { id: true, name: true, nummer: true } },
      },
      orderBy: [{ game: { name: "asc" } }, { rangImGame: "asc" }],
    });

    return NextResponse.json(istOrga ? ergebnisse : sanitizeErgebnisRows(ergebnisse));
  } catch (error) {
    console.error("GET /api/ergebnisse error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST /api/ergebnisse
export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireRole("SCHIEDSRICHTER");
  if (authError) return authError;

  try {
    const gamedayConfig = await prisma.gamedayConfig.findFirst({
      where: { modus: { not: "INAKTIV" } },
      orderBy: { createdAt: "desc" },
    });

    if (!gamedayConfig) {
      return NextResponse.json(
        { error: "Kein aktiver Gameday — Ergebnisse können nur während eines aktiven Gamedays erfasst werden" },
        { status: 400 },
      );
    }

    const istTest = gamedayConfig.modus === "TEST";

    const body = await request.json();
    const parsed = ErgebnisCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
    }

    const { gameId, teamId, zeitplanSlotId, commitId } = parsed.data;
    const rohdaten = parsed.data.rohdaten as Prisma.InputJsonValue & Record<string, unknown>;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, wertungslogik: true, wertungstyp: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Game nicht gefunden" }, { status: 404 });
    }

    const wertungslogik = game.wertungslogik as Wertungslogik | null;

    // Strukturierte Wertungstypen: Rohdaten-Form an der Grenze prüfen,
    // statt fehlerhafte Eingaben still als 0 Punkte zu werten
    const validierung = validiereRohdaten(wertungslogik, rohdaten as Record<string, unknown>);
    if (!validierung.ok) {
      return NextResponse.json({ error: validierung.fehler }, { status: 400 });
    }

    const gamePunkte = berechneGamePunkteAusRohdaten(
      rohdaten as Record<string, unknown>,
      wertungslogik,
    );

    const userId = session?.user?.id ?? null;
    const istOrga = hasMinRole(session?.user?.rolle ?? "", "ORGA");
    const now = new Date();

    // Idempotenz: gleicher commitId für dasselbe Game/Team bedeutet, dass die
    // Übermittlung bereits verarbeitet wurde (z.B. Retry nach Verbindungsabbruch).
    if (commitId) {
      const replay = await prisma.ergebnis.findUnique({
        where: { gameId_teamId: { gameId, teamId } },
      });
      if (replay && replay.commitId === commitId) {
        return NextResponse.json(replay, { status: 200 });
      }
    }

    const ergebnis = await prisma.$transaction(async (tx) => {
      const existing = await tx.ergebnis.findUnique({
        where: { gameId_teamId: { gameId, teamId } },
        include: {
          eingetragenVon: { select: { name: true } },
          team: { select: { name: true } },
        },
      });

      // LAUFEND-Platzhalter aus /api/partie/start sind kein echtes Ergebnis:
      // die Sperrfrist läuft erst ab dem ersten echten Eintrag, nicht ab Partie-Start
      const istPlatzhalter = existing?.status === "LAUFEND";

      // Sperrfrist: Schiedsrichter dürfen nur innerhalb des Korrekturfensters ändern
      if (existing && !istPlatzhalter && !istOrga && istGesperrt(existing.eingetragenUm)) {
        throw new LockedError(existing.eingetragenUm);
      }

      // Fremdes Ergebnis nicht kommentarlos überschreiben. Die eigene Korrektur
      // (gleiche Person) und der Wiederholungs-Versand desselben Commits
      // bleiben erlaubt, ORGA/Admin korrigieren ohnehin bewusst.
      if (
        existing &&
        !istPlatzhalter &&
        !istOrga &&
        existing.eingetragenVonId &&
        existing.eingetragenVonId !== userId &&
        (!commitId || existing.commitId !== commitId)
      ) {
        throw new ConflictError(
          existing.eingetragenVon?.name ?? null,
          existing.eingetragenUm,
          existing.team?.name ?? null,
        );
      }

      const result = await tx.ergebnis.upsert({
        where: { gameId_teamId: { gameId, teamId } },
        create: {
          gameId,
          teamId,
          zeitplanSlotId: zeitplanSlotId || null,
          rohdaten,
          gamePunkte,
          status: "EINGETRAGEN",
          eingetragenVonId: userId,
          eingetragenUm: now,
          istTest,
          commitId: commitId || null,
        },
        update: {
          rohdaten,
          gamePunkte,
          // Erster echter Eintrag ersetzt den Platzhalter (EINGETRAGEN);
          // erst danach ist eine Änderung eine Korrektur
          status: istPlatzhalter ? "EINGETRAGEN" : "KORRIGIERT",
          eingetragenVonId: userId,
          // Korrekturfenster beginnt mit dem ersten echten Eintrag —
          // bei echten Korrekturen läuft der Sperrfrist-Timer ab dem ursprünglichen Eintrag weiter
          eingetragenUm: istPlatzhalter ? now : (existing?.eingetragenUm ?? now),
          istTest,
          commitId: commitId || null,
        },
      });

      await tx.ergebnisHistory.create({
        data: {
          ergebnisId: result.id,
          vorher: existing ? (existing.rohdaten as Prisma.InputJsonValue) : Prisma.JsonNull,
          nachher: rohdaten,
          gamePunkteVorher: existing ? existing.gamePunkte : null,
          gamePunkteNachher: gamePunkte,
          statusVorher: existing ? existing.status : null,
          statusNachher: result.status,
          geaendertVonId: userId,
        },
      });

      await updateGameRaenge(gameId, wertungslogik, tx);

      return result;
    });

    return NextResponse.json(ergebnis, { status: 201 });
  } catch (error) {
    if (error instanceof LockedError) {
      return NextResponse.json(
        {
          code: "LOCKED",
          lockedAt: error.lockedAt,
          error: "Die Korrekturfrist von 10 Minuten ist abgelaufen — nur ein Admin kann das Ergebnis noch korrigieren.",
        },
        { status: 403 },
      );
    }
    if (error instanceof ConflictError) {
      const von = error.bestehend.erfasstVon;
      // Teamname mit in die Meldung: Der Client speichert mehrere Teams in
      // einer Schleife und zeigt nur EINE Fehlerzeile — ohne Namen wüsste der
      // Schiedsrichter nicht, welches Team betroffen ist.
      const team = error.bestehend.teamName;
      return NextResponse.json(
        {
          code: "CONFLICT",
          bestehend: error.bestehend,
          error: `${team ? `${team}: ` : ""}${von ?? "Jemand anderes"} hat für dieses Team bereits ein Ergebnis erfasst — deine Eingabe wurde NICHT gespeichert. Bitte mit der Orga abgleichen.`,
        },
        { status: 409 },
      );
    }
    console.error("POST /api/ergebnisse error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
