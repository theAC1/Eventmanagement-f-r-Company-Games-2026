/**
 * Pure Punkteberechnung aus Schiedsrichter-Rohdaten.
 *
 * Bewusst ohne Prisma-Import gehalten, damit Client-Code (z. B. die
 * Bestätigungs-Vorschau) dieselbe Logik nutzt wie der Server.
 * Server-seitige Rang-Updates liegen in game-punkte.ts.
 */

import {
  GEWICHTUNG_G_DEFAULT,
  GEWICHTUNG_SIEG_DEFAULT,
  ZEIT_DNF_SENTINEL,
  type KleinbegegnungRoh,
  type RundeRoh,
  type TurmRoh,
  type Wertungslogik,
} from "@/lib/wertungslogik-types";

// ─── Rohdaten-Parser (defensiv: unbrauchbare Einträge werden verworfen) ───

function alsZahl(wert: unknown): number {
  const n = Number(wert);
  return Number.isFinite(n) ? n : 0;
}

function alsZahlMin0(wert: unknown): number {
  return Math.max(0, alsZahl(wert));
}

export function parseKleinbegegnungen(rohdaten: Record<string, unknown>): KleinbegegnungRoh[] {
  const roh = rohdaten.kleinbegegnungen;
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((kb): kb is Record<string, unknown> => typeof kb === "object" && kb !== null)
    .map((kb) => ({ eigene: alsZahlMin0(kb.eigene), gegner: alsZahlMin0(kb.gegner) }));
}

export function parseRunden(rohdaten: Record<string, unknown>): RundeRoh[] {
  const roh = rohdaten.runden;
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({ baelle: alsZahlMin0(r.baelle), strafpunkte: alsZahlMin0(r.strafpunkte) }));
}

export function parseTuerme(rohdaten: Record<string, unknown>): TurmRoh[] {
  const roh = rohdaten.tuerme;
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
    .map((t) => ({ sektionen: alsZahlMin0(t.sektionen), bonus: alsZahlMin0(t.bonus) }));
}

// ─── Teilberechnungen (auch für UI-Vorschauen nutzbar) ───

export type KleinbegegnungenStatistik = {
  gespielt: number;
  /** Siege inkl. 0.5 pro Unentschieden (vorläufige Regel bis zum Stechen-Entscheid) */
  siege: number;
  siegquote: number;
  mittelwert: number;
};

export function berechneKleinbegegnungenStatistik(
  kleinbegegnungen: KleinbegegnungRoh[],
): KleinbegegnungenStatistik {
  const gespielt = kleinbegegnungen.length;
  if (gespielt === 0) {
    return { gespielt: 0, siege: 0, siegquote: 0, mittelwert: 0 };
  }
  let siege = 0;
  let punkteSumme = 0;
  for (const kb of kleinbegegnungen) {
    if (kb.eigene > kb.gegner) siege += 1;
    else if (kb.eigene === kb.gegner) siege += 0.5;
    punkteSumme += kb.eigene;
  }
  return {
    gespielt,
    siege,
    siegquote: siege / gespielt,
    mittelwert: punkteSumme / gespielt,
  };
}

/**
 * Spiegelt Kleinbegegnungen in die Sicht des Gegner-Teams
 * (Cornhole-Duell: der Schiedsrichter erfasst eine Liste, beide Teams
 * erhalten dieselben Begegnungen aus ihrer jeweiligen Perspektive).
 */
export function spiegleKleinbegegnungen(
  kleinbegegnungen: KleinbegegnungRoh[],
): KleinbegegnungRoh[] {
  return kleinbegegnungen.map((kb) => ({ eigene: kb.gegner, gegner: kb.eigene }));
}

/** Punkte eines einzelnen Turms inkl. abgeleitetem 100%-Bonus */
export function berechneTurmPunkte(
  roh: TurmRoh,
  config: { sektionen: number; bonus: number },
): number {
  const sektionen = Math.min(roh.sektionen, config.sektionen);
  const bonus = Math.min(roh.bonus, config.bonus);
  const vollstaendig = sektionen === config.sektionen && bonus === config.bonus;
  return sektionen + bonus + (vollstaendig ? 1 : 0);
}

/** Maximal erreichbare Punkte über alle Türme (Robert Huber Radio: 19) */
export function berechneTuermeMaximum(tuerme: Array<{ sektionen: number; bonus: number }>): number {
  return tuerme.reduce((summe, t) => summe + t.sektionen + t.bonus + 1, 0);
}

function runde2(wert: number): number {
  return Math.round(wert * 100) / 100;
}

// ─── Hauptfunktion ───

export function berechneGamePunkteAusRohdaten(
  rohdaten: Record<string, unknown>,
  wertungslogik: Wertungslogik | null,
): number {
  if (!wertungslogik) return 0;

  switch (wertungslogik.typ) {
    case "max_value": {
      const messung = wertungslogik.messung;
      return messung ? alsZahl(rohdaten[messung]) : 0;
    }

    case "zeit": {
      const dnfWert = wertungslogik.maxSekunden ?? ZEIT_DNF_SENTINEL;
      if (rohdaten.nicht_geschafft || rohdaten.geschafft === false) {
        return dnfWert;
      }
      const zeit = alsZahl(rohdaten.zeit_sekunden ?? rohdaten.durchgang_1 ?? 0);
      let strafzeit = 0;
      if (wertungslogik.strafen) {
        for (const [key, sekunden] of Object.entries(wertungslogik.strafen)) {
          strafzeit += alsZahlMin0(rohdaten[key]) * sekunden;
        }
      }
      const gesamt = zeit + strafzeit;
      // Protokoll: Wer das Limit reisst, bekommt schlicht die Maximalzeit eingetragen
      return wertungslogik.maxSekunden !== undefined
        ? Math.min(gesamt, wertungslogik.maxSekunden)
        : gesamt;
    }

    case "punkte_duell": {
      const felder = wertungslogik.eingabefelder;
      if (!felder) return 0;
      // Erstes Feld mit gesetztem Wert zurückgeben — Team A nutzt felder[0], Team B felder[1]
      for (const f of felder) {
        const val = rohdaten[f.name];
        if (val !== undefined && val !== null) {
          return alsZahl(val);
        }
      }
      return 0;
    }

    case "duell_kleinbegegnungen": {
      const statistik = berechneKleinbegegnungenStatistik(parseKleinbegegnungen(rohdaten));
      if (statistik.gespielt === 0) return 0;
      const g = wertungslogik.gewichtungG ?? GEWICHTUNG_G_DEFAULT;
      return runde2(statistik.siegquote * g + statistik.mittelwert);
    }

    case "runden_strafpunkte": {
      const runden = parseRunden(rohdaten);
      return runden.reduce((summe, r) => summe + r.baelle + r.strafpunkte, 0);
    }

    case "tuerme_punkte": {
      const configs = wertungslogik.tuerme;
      if (!configs?.length) return 0;
      const roh = parseTuerme(rohdaten);
      return configs.reduce((summe, config, i) => {
        const turmRoh = roh[i] ?? { sektionen: 0, bonus: 0 };
        return summe + berechneTurmPunkte(turmRoh, config);
      }, 0);
    }

    case "sieg_zuege": {
      const siege = alsZahlMin0(rohdaten.siege);
      const zuege = alsZahlMin0(rohdaten.zuege);
      const gewichtung = wertungslogik.gewichtungSieg ?? GEWICHTUNG_SIEG_DEFAULT;
      return Math.max(0, siege * gewichtung - zuege);
    }

    case "formel": {
      const felder = wertungslogik.eingabefelder;
      if (!felder) return 0;
      let summe = 0;
      for (const f of felder) {
        const val = alsZahl(rohdaten[f.name]);
        summe += val * val;
      }
      return summe;
    }

    case "multi_level": {
      const gewaehlterLevel = rohdaten.level as string;
      const level = wertungslogik.levels?.find((l) => l.name === gewaehlterLevel);
      if (!level) return 0;
      const zeit = alsZahl(rohdaten.zeit_sekunden ?? 0);
      return Math.max(0, level.grundpunkte - zeit * 0.1);
    }

    case "risiko_wahl": {
      const gewaehlteOption = rohdaten.option as string;
      const option = wertungslogik.optionen?.find((o) => o.name === gewaehlteOption);
      if (!option) return 0;
      const erfolg = rohdaten.erfolg === true || rohdaten.erfolg === "true";
      return erfolg ? option.punkte_erfolg : option.punkte_fail;
    }

    default:
      return 0;
  }
}
