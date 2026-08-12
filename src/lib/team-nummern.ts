/**
 * Startnummern der Teams.
 *
 * `Team.nummer` ist eindeutig und wird beim Löschen nicht nachgezogen: nach
 * dem Entfernen von drei Teams bleibt die höchste Nummer 17 stehen, während 15
 * und 16 fehlen. Für Badges, Ranglisten und Zurufe am Turniertag ist eine
 * lückenlose Reihe 1…N das, was die Orga erwartet.
 *
 * Reine Funktionen — die Datenbankschritte liegen in der Route.
 */

export type TeamNummer = { id: string; nummer: number };

/**
 * Neue Nummern 1…N, Reihenfolge bleibt die bisherige.
 * Enthält nur Teams, deren Nummer sich tatsächlich ändert.
 */
export function neueNummern(teams: readonly TeamNummer[]): TeamNummer[] {
  return [...teams]
    .sort((a, b) => a.nummer - b.nummer)
    .map((team, index) => ({ id: team.id, nummer: index + 1 }))
    .filter((neu, index) => {
      const alt = [...teams].sort((a, b) => a.nummer - b.nummer)[index];
      return alt.nummer !== neu.nummer;
    });
}

/** Hat die Reihe Lücken oder beginnt sie nicht bei 1? */
export function hatLuecken(teams: readonly TeamNummer[]): boolean {
  if (teams.length === 0) return false;
  const sortiert = [...teams].sort((a, b) => a.nummer - b.nummer);
  return sortiert.some((team, index) => team.nummer !== index + 1);
}

/** Nächste freie Nummer — die kleinste Lücke, sonst eins über dem Maximum. */
export function naechsteFreieNummer(vergeben: readonly number[]): number {
  const gesetzt = new Set(vergeben);
  let kandidat = 1;
  while (gesetzt.has(kandidat)) kandidat++;
  return kandidat;
}
