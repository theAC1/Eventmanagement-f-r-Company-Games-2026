/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { berechneGameRang } from "@/lib/rangpunkte";

/**
 * Berechnet gamePunkte aus Rohdaten basierend auf der Wertungslogik
 */
export function berechneGamePunkteAusRohdaten(
  rohdaten: Record<string, any>,
  wertungslogik: any,
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
      if (strafen && typeof strafen === "object") {
        for (const [key, sekunden] of Object.entries(strafen)) {
          const anzahl = Number(rohdaten[key] ?? 0);
          strafzeit += anzahl * (sekunden as number);
        }
      }
      if (rohdaten.nicht_geschafft || rohdaten.geschafft === false) {
        return 99999;
      }
      return zeit + strafzeit;
    }

    case "punkte_duell": {
      const felder = wertungslogik.eingabefelder;
      if (felder && felder.length >= 1) {
        return Number(rohdaten[felder[0].name] ?? 0);
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
      const level = levels?.find((l: any) => l.name === gewaehlterLevel);
      if (!level) return 0;
      const zeit = Number(rohdaten.zeit_sekunden ?? 0);
      return Math.max(0, level.grundpunkte - zeit * 0.1);
    }

    case "risiko_wahl": {
      const optionen = wertungslogik.optionen;
      const gewaehlteOption = rohdaten.option as string;
      const option = optionen?.find((o: any) => o.name === gewaehlteOption);
      if (!option) return 0;
      const erfolg = rohdaten.erfolg === true || rohdaten.erfolg === "true";
      return erfolg ? option.punkte_erfolg : option.punkte_fail;
    }

    default:
      return 0;
  }
}

/**
 * Aktualisiert die Raenge fuer alle Ergebnisse eines Games
 */
export async function updateGameRaenge(gameId: string, wertungslogik: any) {
  const ergebnisse = await prisma.ergebnis.findMany({
    where: { gameId, gamePunkte: { not: null } },
    select: { id: true, gameId: true, teamId: true, gamePunkte: true, rohdaten: true },
  });

  const raenge = berechneGameRang(
    ergebnisse.map((e: any) => ({
      ...e,
      rohdaten: (e.rohdaten ?? {}) as Record<string, unknown>,
    })),
    wertungslogik,
  );

  for (const rang of raenge) {
    await prisma.ergebnis.update({
      where: { id: rang.ergebnisId },
      data: {
        rangImGame: rang.rangImGame,
        rangPunkte: rang.rangPunkte,
      },
    });
  }
}
