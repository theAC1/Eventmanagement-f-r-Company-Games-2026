export type PasswordRules = {
  laenge: boolean;
  grossbuchstabe: boolean;
  kleinbuchstabe: boolean;
  zahl: boolean;
  sonderzeichen: boolean;
};

export const PASSWORD_RULE_LABELS: { key: keyof PasswordRules; label: string }[] = [
  { key: "laenge", label: "Mindestens 10 Zeichen" },
  { key: "grossbuchstabe", label: "Ein Großbuchstabe" },
  { key: "kleinbuchstabe", label: "Ein Kleinbuchstabe" },
  { key: "zahl", label: "Eine Zahl" },
  { key: "sonderzeichen", label: "Ein Sonderzeichen" },
];

export function checkPassword(passwort: string): PasswordRules {
  return {
    laenge: passwort.length >= 10,
    grossbuchstabe: /[A-ZÄÖÜ]/.test(passwort),
    kleinbuchstabe: /[a-zäöü]/.test(passwort),
    zahl: /[0-9]/.test(passwort),
    sonderzeichen: /[^A-Za-z0-9ÄÖÜäöü]/.test(passwort),
  };
}

export function isPasswordValid(passwort: string): boolean {
  return Object.values(checkPassword(passwort)).every(Boolean);
}
