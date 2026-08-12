/**
 * Zeitrechnung im Tagesraster.
 *
 * Der Zeitplan rechnet durchgehend in Minuten ab Mitternacht. Späte Pläne
 * dürfen über 24:00 hinauslaufen ("24:15") — deshalb kein Modulo beim
 * Formatieren.
 */

/** "09:30" → 570. Ungültige Eingaben ergeben NaN, nie stillschweigend 0. */
export function parseZeit(zeit: string): number {
  const treffer = /^(\d{1,2}):([0-5]\d)$/.exec(zeit.trim());
  if (!treffer) return NaN;
  return Number(treffer[1]) * 60 + Number(treffer[2]);
}

/** 570 → "09:30". Negative Werte werden auf 00:00 geklemmt. */
export function formatZeit(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${String(h).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Überlappen sich [aVon, aBis) und [bVon, bBis)? */
export function ueberlappt(
  aVon: number,
  aBis: number,
  bVon: number,
  bBis: number,
): boolean {
  return aVon < bBis && bVon < aBis;
}

/** Dauer als "1 h 45 min" / "45 min" — für Fenster- und Überzugs-Hinweise. */
export function formatDauer(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}
