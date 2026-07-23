// Passwort-Stärke-Regeln — geteilt zwischen Server-Validierung und Client-UI.

export type PasswordRules = {
  laenge: boolean;
  grossbuchstabe: boolean;
  kleinbuchstabe: boolean;
  zahl: boolean;
  sonderzeichen: boolean;
};

export const PASSWORD_RULE_LABELS: { key: keyof PasswordRules; label: string }[] = [
  { key: "laenge", label: "Mindestens 10 Zeichen" },
  { key: "grossbuchstabe", label: "Ein Grossbuchstabe" },
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

export type PasswordCheck = {
  ok: boolean;
  fehler: string[];
  regeln: PasswordRules;
};

export function validatePassword(passwort: string): PasswordCheck {
  const regeln = checkPassword(passwort);

  const fehler: string[] = [];
  if (!regeln.laenge) fehler.push("Mindestens 10 Zeichen");
  if (!regeln.grossbuchstabe) fehler.push("Mindestens ein Grossbuchstabe");
  if (!regeln.kleinbuchstabe) fehler.push("Mindestens ein Kleinbuchstabe");
  if (!regeln.zahl) fehler.push("Mindestens eine Zahl");
  if (!regeln.sonderzeichen) fehler.push("Mindestens ein Sonderzeichen");

  return { ok: fehler.length === 0, fehler, regeln };
}
