/**
 * Klartext statt "Fehler beim Löschen".
 *
 * Löschen scheiterte bisher stumm an Fremdschlüsseln: ein Team, das in einem
 * gespeicherten Zeitplan steht, liess sich nicht entfernen — die Oberfläche
 * meldete nichts und lud die unveränderte Liste neu.
 *
 * Die Trennung ist bewusst:
 * - Planungsdaten (Zeitplan-Slots, Posten-Zuteilungen) räumt die Datenbank per
 *   Cascade mit weg; sie sind reproduzierbar.
 * - Ergebnisdaten (Ergebnisse, QR-Verifikationen) blockieren das Löschen. Sie
 *   sind der Wertungsstand des Turniertags und dürfen nie beiläufig verschwinden.
 *
 * Reine Funktionen — die Zählwerte kommen aus der jeweiligen Route.
 */

export type LoeschHindernis = {
  /** Was im Weg steht, im Plural ("Ergebnisse"). */
  was: string;
  anzahl: number;
};

export type LoeschEntscheid = {
  erlaubt: boolean;
  /** Klartext für die UI; null wenn erlaubt. */
  grund: string | null;
};

function auflisten(hindernisse: readonly LoeschHindernis[]): string {
  return hindernisse
    .filter((h) => h.anzahl > 0)
    .map((h) => `${h.anzahl} ${h.was}`)
    .join(" und ");
}

/**
 * Darf gelöscht werden? `hindernisse` sind Zählwerte von Daten, die beim
 * Löschen unwiederbringlich verloren gingen.
 */
export function pruefeLoeschen(
  bezeichnung: string,
  hindernisse: readonly LoeschHindernis[],
  hinweis = "Lösche zuerst die abhängigen Daten oder setze den Gameday zurück.",
): LoeschEntscheid {
  const text = auflisten(hindernisse);
  if (text.length === 0) return { erlaubt: true, grund: null };
  return {
    erlaubt: false,
    grund: `${bezeichnung} kann nicht gelöscht werden: daran hängen ${text}. ${hinweis}`,
  };
}

/**
 * Was beim Löschen mitgeht, damit die Bestätigung im UI ehrlich ist.
 * Leeres Array ⇒ es geht nichts verloren.
 */
export function loeschFolgen(folgen: readonly LoeschHindernis[]): string[] {
  return folgen
    .filter((f) => f.anzahl > 0)
    .map((f) => `${f.anzahl} ${f.was} werden mitgelöscht.`);
}
