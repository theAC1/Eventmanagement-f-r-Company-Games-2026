import { randomInt } from "crypto";

/**
 * Generiert einzigartige 3-Zeichen Check-in-Codes
 * Format: BUCHSTABE + ZAHL + BUCHSTABE (z.B. B6J, L9W)
 * 24 × 8 × 24 = 4'608 mögliche Kombinationen
 * Verwendet crypto.randomInt statt Math.random für Sicherheit
 */

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // ohne I und O (Verwechslungsgefahr mit 1 und 0)
const DIGITS = "23456789"; // ohne 0 und 1 (Verwechslungsgefahr)

function generateCheckinCode(): string {
  const l1 = LETTERS[randomInt(LETTERS.length)];
  const d = DIGITS[randomInt(DIGITS.length)];
  const l2 = LETTERS[randomInt(LETTERS.length)];
  return `${l1}${d}${l2}`;
}

/**
 * Generiert einen Code der nicht in existingCodes vorkommt
 */
export function generateUniqueCheckinCode(existingCodes: Set<string>): string {
  let code: string;
  let attempts = 0;
  do {
    code = generateCheckinCode();
    attempts++;
    if (attempts > 100) throw new Error("Zu viele Versuche – Check-in-Codes aufgebraucht");
  } while (existingCodes.has(code));
  return code;
}
