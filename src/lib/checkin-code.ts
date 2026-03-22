/**
 * Generiert einzigartige 3-Zeichen Check-in-Codes
 * Format: BUCHSTABE + ZAHL + BUCHSTABE (z.B. B6J, L9W)
 * 26 × 10 × 26 = 6'760 mögliche Kombinationen
 */

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // ohne I und O (Verwechslungsgefahr mit 1 und 0)
const DIGITS = "23456789"; // ohne 0 und 1 (Verwechslungsgefahr)

export function generateCheckinCode(): string {
  const l1 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const d = DIGITS[Math.floor(Math.random() * DIGITS.length)];
  const l2 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
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
