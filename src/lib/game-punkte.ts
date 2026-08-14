import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { berechneGameRang } from "@/lib/rangpunkte";
import {
  berechneGamePunkteAusRohdaten,
  parseKleinbegegnungen,
  spiegleKleinbegegnungen,
} from "@/lib/game-punkte-berechnung";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

// Pure Berechnung lebt in game-punkte-berechnung.ts (Client-tauglich);
// Re-Export hält bestehende Server-Importe stabil.
export { berechneGamePunkteAusRohdaten } from "@/lib/game-punkte-berechnung";

type DbClient = Pick<typeof prisma, "ergebnis">;

type DuellSyncClient = Pick<typeof prisma, "ergebnis" | "ergebnisHistory">;

export async function updateGameRaenge(
  gameId: string,
  wertungslogik: Wertungslogik | null,
  db: DbClient = prisma,
) {
  const ergebnisse = await db.ergebnis.findMany({
    where: { gameId, gamePunkte: { not: null } },
    select: { id: true, gameId: true, teamId: true, gamePunkte: true, rohdaten: true },
  });

  const raenge = berechneGameRang(
    ergebnisse.map((e) => ({
      ...e,
      rohdaten: (e.rohdaten ?? {}) as Record<string, unknown>,
    })),
    wertungslogik,
  );

  // Sequenziell und in stabiler Reihenfolge (nach ergebnisId), nicht per
  // Promise.all in Rang-Reihenfolge.
  //
  // Zwei Gründe: (1) parallele Writes auf der einen Connection einer
  // interaktiven Transaktion sind ein dokumentiertes Prisma-Anti-Pattern —
  // genau wie in berechneGamePunkteNeu unten. (2) Die Rang-Reihenfolge
  // unterscheidet sich zwischen gleichzeitigen Transaktionen; zwei
  // Schiedsrichter, die dasselbe Game gleichzeitig speichern, würden dieselben
  // Zeilen in unterschiedlicher Reihenfolge sperren und könnten sich
  // verklemmen. Eine feste Sortierung nimmt die Sperren immer gleich auf.
  const sortiert = [...raenge].sort((a, b) => a.ergebnisId.localeCompare(b.ergebnisId));
  for (const rang of sortiert) {
    await db.ergebnis.update({
      where: { id: rang.ergebnisId },
      data: { rangImGame: rang.rangImGame, rangPunkte: rang.rangPunkte },
    });
  }
}

/**
 * Rechnet gamePunkte aller bereits eingetragenen Ergebnisse eines Games aus den
 * Rohdaten neu und aktualisiert danach die Ränge.
 *
 * Nötig, wenn die Orga die Wertungslogik nachträglich ändert (z. B. den
 * Gewichtungsfaktor G bei Cornhole im Leitstand justiert) — die gespeicherten
 * Rohdaten bleiben unverändert, nur die abgeleiteten Punkte ändern sich.
 */
export async function berechneGamePunkteNeu(
  gameId: string,
  wertungslogik: Wertungslogik | null,
  db: DbClient = prisma,
): Promise<number> {
  // Nur abgeschlossene Eingaben — LAUFEND-Platzhalter (gamePunkte null) bleiben unberührt
  const ergebnisse = await db.ergebnis.findMany({
    where: { gameId, gamePunkte: { not: null } },
    select: { id: true, rohdaten: true },
  });

  // Sequenziell statt Promise.all: parallele Writes auf der einzelnen Connection
  // einer interaktiven Transaktion sind ein dokumentiertes Prisma-Anti-Pattern
  // (Risiko «Transaction already closed» bei vielen Ergebnissen).
  for (const e of ergebnisse) {
    await db.ergebnis.update({
      where: { id: e.id },
      data: {
        gamePunkte: berechneGamePunkteAusRohdaten(
          (e.rohdaten ?? {}) as Record<string, unknown>,
          wertungslogik,
        ),
      },
    });
  }

  await updateGameRaenge(gameId, wertungslogik, db);
  return ergebnisse.length;
}

/** Minimale Felder, um das Partner-Ergebnis eines Duells zu bestimmen */
export type DuellPartnerSuche = {
  id: string;
  gameId: string;
  commitId: string | null;
  zeitplanSlotId: string | null;
};

/**
 * Sucht das Partner-Ergebnis eines Duells: die andere Ergebnis-Zeile desselben
 * Games mit demselben non-null commitId, sonst mit demselben non-null
 * zeitplanSlotId. Nur ein EINDEUTIGER Treffer zählt — sonst null.
 */
export async function findeDuellPartner(
  ergebnis: DuellPartnerSuche,
  db: DbClient = prisma,
) {
  if (ergebnis.commitId) {
    const treffer = await db.ergebnis.findMany({
      where: {
        gameId: ergebnis.gameId,
        commitId: ergebnis.commitId,
        id: { not: ergebnis.id },
      },
    });
    if (treffer.length === 1) return treffer[0];
    if (treffer.length > 1) return null;
  }

  if (ergebnis.zeitplanSlotId) {
    const treffer = await db.ergebnis.findMany({
      where: {
        gameId: ergebnis.gameId,
        zeitplanSlotId: ergebnis.zeitplanSlotId,
        id: { not: ergebnis.id },
      },
    });
    if (treffer.length === 1) return treffer[0];
  }

  return null;
}

/**
 * Cornhole-Duell (duell_kleinbegegnungen): die zwei Ergebnis-Zeilen eines
 * Duells sind gespiegelte Kopien derselben Kleinbegegnungen. Nach einer
 * Korrektur zieht diese Funktion das Partner-Ergebnis in derselben
 * Transaktion nach (Spiegel-Invariante), inklusive History-Eintrag.
 *
 * @returns true, wenn der Partner eindeutig gefunden und synchronisiert wurde
 */
export async function synchronisiereDuellSpiegel(
  ergebnis: DuellPartnerSuche,
  neueRohdaten: Record<string, unknown>,
  wertungslogik: Wertungslogik | null,
  geaendertVonId: string | null,
  db: DuellSyncClient,
): Promise<boolean> {
  const partner = await findeDuellPartner(ergebnis, db);
  if (!partner) return false;

  const partnerRohdaten = {
    ...((partner.rohdaten ?? {}) as Record<string, unknown>),
    kleinbegegnungen: spiegleKleinbegegnungen(parseKleinbegegnungen(neueRohdaten)),
  };
  const partnerPunkte = berechneGamePunkteAusRohdaten(partnerRohdaten, wertungslogik);

  await db.ergebnis.update({
    where: { id: partner.id },
    data: {
      rohdaten: partnerRohdaten as Prisma.InputJsonValue,
      gamePunkte: partnerPunkte,
      status: "KORRIGIERT",
    },
  });

  await db.ergebnisHistory.create({
    data: {
      ergebnisId: partner.id,
      vorher: partner.rohdaten as Prisma.InputJsonValue,
      nachher: partnerRohdaten as Prisma.InputJsonValue,
      gamePunkteVorher: partner.gamePunkte,
      gamePunkteNachher: partnerPunkte,
      statusVorher: partner.status,
      statusNachher: "KORRIGIERT",
      grund: "Automatische Spiegel-Korrektur (Cornhole-Duell)",
      geaendertVonId,
    },
  });

  return true;
}
