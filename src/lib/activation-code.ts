import crypto from "crypto";

// Kryptographisch zufälliger Aktivierungscode (12 Zeichen, alphanumerisch,
// ohne leicht verwechselbare Zeichen wie I/O/l/0/1)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateActivationCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}
