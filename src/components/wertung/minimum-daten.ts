/**
 * Mindestdaten-Prüfung pro Wertungstyp: Erst wenn jedes Team diese
 * Anforderung erfüllt, gibt die Live-Erfassung den Schritt
 * "Ergebnis eintragen" (Bestätigung) frei.
 */

import {
  parseKleinbegegnungen,
  parseRunden,
  parseTuerme,
} from "@/lib/game-punkte-berechnung";
import type { Wertungslogik } from "@/lib/wertungslogik-types";

export function hatMinimumDaten(
  wl: Wertungslogik,
  rohdaten: Record<string, unknown>,
): boolean {
  switch (wl.typ) {
    case "punkte_duell": {
      // Team A schreibt felder[0], Team B felder[1] — ein gesetztes Feld genügt.
      const felder = wl.eingabefelder ?? [];
      return felder.length === 0 || felder.some((f) => rohdaten[f.name] !== undefined);
    }
    case "zeit": {
      if (wl.eingabefelder?.length) return true;
      const zeit = Number(rohdaten.zeit_sekunden);
      return (Number.isFinite(zeit) && zeit > 0) || rohdaten.nicht_geschafft === true;
    }
    case "max_value":
      return !wl.eingabefelder?.length || rohdaten[wl.eingabefelder[0].name] !== undefined;
    case "multi_level":
      return Boolean(rohdaten.level);
    case "risiko_wahl":
      return Boolean(rohdaten.option) && rohdaten.erfolg !== undefined;
    case "formel":
      return !(wl.eingabefelder ?? []).some((f) => rohdaten[f.name] === undefined);
    case "duell_kleinbegegnungen":
      return parseKleinbegegnungen(rohdaten).length >= 1;
    case "runden_strafpunkte":
      // Protokoll: fixe Rundenzahl — deckungsgleich mit der Server-Validierung
      return parseRunden(rohdaten).length === (wl.runden ?? 3);
    case "tuerme_punkte":
      // Bei konfigurierten Türmen: genau ein Eintrag pro Turm (Null-Werte zählen)
      return wl.tuerme !== undefined
        ? parseTuerme(rohdaten).length === wl.tuerme.length
        : Array.isArray(rohdaten.tuerme);
    case "sieg_zuege":
      return rohdaten.siege !== undefined && rohdaten.zuege !== undefined;
    default:
      return true;
  }
}
