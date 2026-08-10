/** Anzeige-Formatierung für Wertungs-Rohwerte (rein, ohne React). */

/** Sekunden als "m:ss" (z. B. 600 → "10:00", 45 → "0:45"). */
export function formatSekundenMSS(sekunden: number): string {
  const ganz = Math.max(0, Math.floor(sekunden));
  const m = Math.floor(ganz / 60);
  const s = ganz % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Siege inkl. halber Siege kompakt anzeigen (1 → "1", 1.5 → "1.5"). */
export function formatSiege(siege: number): string {
  return Number.isInteger(siege) ? String(siege) : siege.toFixed(1);
}

/** Punktzahl ohne unnötige Nachkommastelle (8 → "8", 41.33 → "41.3"). */
export function formatPunktzahl(punkte: number): string {
  return Number.isInteger(punkte) ? String(punkte) : punkte.toFixed(1);
}
