import { randomInt } from "crypto";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function generateCheckinCode(): string {
  const l1 = LETTERS[randomInt(LETTERS.length)];
  const d = DIGITS[randomInt(DIGITS.length)];
  const l2 = LETTERS[randomInt(LETTERS.length)];
  return `${l1}${d}${l2}`;
}

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
