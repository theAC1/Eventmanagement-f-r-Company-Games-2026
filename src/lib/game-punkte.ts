import { prisma } from "@/lib/prisma";
import { berechneGameRang } from "@/lib/rangpunkte";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

type DbClient = Pick<typeof prisma, "ergebnis">;

export function berechneGamePunkteAusRohdaten(
  rohdaten: Record<string, unknown>,
  wertungslogik: Wertungslogik | null,
): number {
  if (!wertungslogik) return 0;

  const typ = wertungslogik.typ;

  switch (typ) {
    case "max_value": {
      const messung = wertungslogik.messung;
      return messung ? (Number(rohdaten[messung]) || 0) : 0;
    }

    case "zeit": {
      const zeit = Number(rohdaten.zeit_sekunden ?? rohdaten.durchgang_1 ?? 0);
      const strafen = wertungslogik.strafen;
      let strafzeit = 0;
      if (strafen) {
        for (const [key, sekunden] of Object.entries(strafen)) {
          const anzahl = Number(rohdaten[key] ?? 0);
          strafzeit += anzahl * sekunden;
        }
      }
      if (rohdaten.nicht_geschafft || rohdaten.geschafft === false) {
        return 99999;
      }
      return zeit + strafzeit;
    }

    case "punkte_duell": {
      const felder = wertungslogik.eingabefelder;
      if (!felder) return 0;
      // Erstes Feld mit gesetztem Wert zurückgeben — Team A nutzt felder[0], Team B felder[1]
      for (const f of felder) {
        const val = rohdaten[f.name];
        if (val !== undefined && val !== null) {
          return Number(val);
        }
      }
      return 0;
    }

    case "formel": {
      const felder = wertungslogik.eingabefelder;
      if (!felder) return 0;
      let summe = 0;
      for (const f of felder) {
        const val = Number(rohdaten[f.name] ?? 0);
        summe += val * val;
      }
      return summe;
    }

    case "multi_level": {
      const levels = wertungslogik.levels;
      const gewaehlterLevel = rohdaten.level as string;
      const level = levels?.find((l) => l.name === gewaehlterLevel);
      if (!level) return 0;
      const zeit = Number(rohdaten.zeit_sekunden ?? 0);
      return Math.max(0, level.grundpunkte - zeit * 0.1);
    }

    case "risiko_wahl": {
      const optionen = wertungslogik.optionen;
      const gewaehlteOption = rohdaten.option as string;
      const option = optionen?.find((o) => o.name === gewaehlteOption);
      if (!option) return 0;
      const erfolg = rohdaten.erfolg === true || rohdaten.erfolg === "true";
      return erfolg ? option.punkte_erfolg : option.punkte_fail;
    }

    default:
      return 0;
  }
}

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

  await Promise.all(
    raenge.map((rang) =>
      db.ergebnis.update({
        where: { id: rang.ergebnisId },
        data: { rangImGame: rang.rangImGame, rangPunkte: rang.rangPunkte },
      })
    )
  );
}
