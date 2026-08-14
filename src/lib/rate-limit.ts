// In-Memory Sliding-Window-Rate-Limiter für Login-Versuche.
// Ausreichend für das Single-Container-Deployment; bei Neustart wird der
// Zähler geleert, was für Brute-Force-Schutz akzeptabel ist.

const buckets = new Map<string, number[]>();

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// 20 → 60: Beim Tooltest sitzen mehrere Schiedsrichter/Orga am selben
// Venue-WLAN und teilen sich damit eine öffentliche IP — und damit denselben
// Bucket. 20 Versuche/15min reichen dann schon bei normalen Tippfehlern für
// einen Gruppen-Lockout. 60 bleibt immer noch ein enger Brute-Force-Schutz
// (5s/Versuch händisch macht in 15min keine 60 voll).
export const LOGIN_MAX_ATTEMPTS = 60;

/**
 * Registriert einen Versuch für `key` und prüft, ob das Limit überschritten ist.
 * Gibt true zurück, wenn der Versuch erlaubt ist.
 */
export function checkRateLimit(
  key: string,
  { windowMs = LOGIN_WINDOW_MS, max = LOGIN_MAX_ATTEMPTS, now = Date.now() } = {},
): boolean {
  const cutoff = now - windowMs;
  const attempts = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (attempts.length >= max) {
    buckets.set(key, attempts);
    return false;
  }

  attempts.push(now);
  buckets.set(key, attempts);

  // Gelegentliches Aufräumen verwaister Keys, damit die Map nicht wächst
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  return true;
}

/** Nur für Tests: setzt alle Zähler zurück. */
export function resetRateLimits(): void {
  buckets.clear();
}
