export type PasswordCheck = {
  ok: boolean;
  fehler: string[];
  regeln: {
    laenge: boolean;
    grossbuchstabe: boolean;
    kleinbuchstabe: boolean;
    zahl: boolean;
    sonderzeichen: boolean;
  };
};

export function validatePassword(passwort: string): PasswordCheck {
  const regeln = {
    laenge: passwort.length >= 10,
    grossbuchstabe: /[A-ZÄÖÜ]/.test(passwort),
    kleinbuchstabe: /[a-zäöü]/.test(passwort),
    zahl: /[0-9]/.test(passwort),
    sonderzeichen: /[^A-Za-z0-9ÄÖÜäöü]/.test(passwort),
  };

  const fehler: string[] = [];
  if (!regeln.laenge) fehler.push("Mindestens 10 Zeichen");
  if (!regeln.grossbuchstabe) fehler.push("Mindestens ein Großbuchstabe");
  if (!regeln.kleinbuchstabe) fehler.push("Mindestens ein Kleinbuchstabe");
  if (!regeln.zahl) fehler.push("Mindestens eine Zahl");
  if (!regeln.sonderzeichen) fehler.push("Mindestens ein Sonderzeichen");

  return { ok: fehler.length === 0, fehler, regeln };
}
