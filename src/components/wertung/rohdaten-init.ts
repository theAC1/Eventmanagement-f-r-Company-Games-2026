/**
 * Struktur-Defaults für Rohdaten der strukturierten Wertungstypen.
 * Rein und ohne React — wird von der Live-Erfassung beim Laden genutzt,
 * damit auch ein Team ohne einzigen Zählerklick (0 Siege, 0 Bälle, …)
 * speicherbar bleibt.
 */

import {
  parseKleinbegegnungen,
  parseRunden,
  parseTuerme,
} from "@/lib/game-punkte-berechnung";
import type { RundeRoh, TurmRoh, Wertungslogik } from "@/lib/wertungslogik-types";

/** Runden-Liste auf die fixe Rundenzahl auffüllen (fehlende Runden = 0/0). */
export function padRunden(runden: RundeRoh[], anzahl: number): RundeRoh[] {
  return Array.from({ length: anzahl }, (_, i) => runden[i] ?? { baelle: 0, strafpunkte: 0 });
}

/** Turm-Werte auf die Anzahl konfigurierter Türme auffüllen (fehlende = 0/0). */
export function padTuerme(werte: TurmRoh[], anzahl: number): TurmRoh[] {
  return Array.from({ length: anzahl }, (_, i) => werte[i] ?? { sektionen: 0, bonus: 0 });
}

/**
 * Ergänzt fehlende Struktur-Schlüssel in den Rohdaten eines Teams,
 * ohne bestehende Werte zu verändern (immutable — gibt eine Kopie zurück).
 */
export function initialisiereRohdaten(
  rohdaten: Record<string, unknown>,
  wertungslogik: Wertungslogik | null,
): Record<string, unknown> {
  if (!wertungslogik) return rohdaten;

  switch (wertungslogik.typ) {
    case "runden_strafpunkte": {
      const anzahl = wertungslogik.runden ?? 3;
      return { ...rohdaten, runden: padRunden(parseRunden(rohdaten), anzahl) };
    }
    case "tuerme_punkte": {
      const anzahl = wertungslogik.tuerme?.length ?? 0;
      return { ...rohdaten, tuerme: padTuerme(parseTuerme(rohdaten), anzahl) };
    }
    case "sieg_zuege":
      return {
        ...rohdaten,
        siege: rohdaten.siege === undefined ? 0 : rohdaten.siege,
        zuege: rohdaten.zuege === undefined ? 0 : rohdaten.zuege,
      };
    case "duell_kleinbegegnungen":
      return { ...rohdaten, kleinbegegnungen: parseKleinbegegnungen(rohdaten) };
    default:
      return rohdaten;
  }
}
