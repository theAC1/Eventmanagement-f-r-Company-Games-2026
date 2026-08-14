/**
 * Die eine Stelle, an der entschieden wird, was beim Speichern eines Teams
 * mit dem Logo passiert — damit `POST /api/teams` und `PUT /api/teams/:id`
 * sich nicht unterschiedlich verhalten können.
 *
 * Bewusst warnen statt blockieren: Ein Logo, das gerade nicht erreichbar ist,
 * darf am Eventtag nicht verhindern, dass die Orga einen Teamnamen korrigiert.
 * Die eingegebene Adresse bleibt erhalten, die Oberfläche sagt aber deutlich,
 * dass sie es nicht aufs Badge schaffen wird.
 */

import { logoUebernehmen } from "./logo-import";

export type LogoAufloesung = {
  /** Was in die Datenbank geschrieben wird. */
  logoUrl: string | null;
  /** Klartext für die Orga, falls das Logo nicht geholt werden konnte. */
  warnung: string | null;
};

export async function logoAufloesen(eingabe: string | null | undefined): Promise<LogoAufloesung> {
  const adresse = eingabe?.trim() ?? "";
  if (adresse.length === 0) return { logoUrl: null, warnung: null };

  const ergebnis = await logoUebernehmen(adresse);
  if ("pfad" in ergebnis) return { logoUrl: ergebnis.pfad, warnung: null };

  return {
    logoUrl: adresse,
    warnung: `Logo konnte nicht übernommen werden: ${ergebnis.fehler}. Auf dem Badge erscheint stattdessen die Startnummer.`,
  };
}
