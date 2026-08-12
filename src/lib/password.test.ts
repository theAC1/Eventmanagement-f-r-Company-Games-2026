import { describe, expect, it } from "vitest";
import {
  PASSWORD_RULE_LABELS,
  checkPassword,
  isPasswordValid,
  validatePassword,
} from "./password";

const GUELTIG = "Turnier2026!";

describe("checkPassword", () => {
  it("erkennt ein Passwort, das alle Regeln erfüllt", () => {
    expect(checkPassword(GUELTIG)).toEqual({
      laenge: true,
      grossbuchstabe: true,
      kleinbuchstabe: true,
      zahl: true,
      sonderzeichen: true,
    });
  });

  it("prüft jede Regel einzeln", () => {
    expect(checkPassword("Kurz1!").laenge).toBe(false);
    expect(checkPassword("turnier2026!").grossbuchstabe).toBe(false);
    expect(checkPassword("TURNIER2026!").kleinbuchstabe).toBe(false);
    expect(checkPassword("TurnierJahr!").zahl).toBe(false);
    expect(checkPassword("Turnier2026").sonderzeichen).toBe(false);
  });

  it("akzeptiert Umlaute als Gross- und Kleinbuchstaben", () => {
    const regeln = checkPassword("Übungsplatz9!");
    expect(regeln.grossbuchstabe).toBe(true);
    expect(regeln.kleinbuchstabe).toBe(true);
    // Umlaute dürfen nicht als Sonderzeichen durchgehen
    expect(checkPassword("Uebungsplätze9").sonderzeichen).toBe(false);
  });

  it("ist bei leerer Eingabe überall falsch", () => {
    expect(Object.values(checkPassword(""))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("isPasswordValid", () => {
  it("verlangt alle Regeln gleichzeitig", () => {
    expect(isPasswordValid(GUELTIG)).toBe(true);
    expect(isPasswordValid("Turnier2026")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("meldet ok ohne Fehlerliste", () => {
    const ergebnis = validatePassword(GUELTIG);
    expect(ergebnis.ok).toBe(true);
    expect(ergebnis.fehler).toEqual([]);
  });

  it("listet jede verletzte Regel einzeln auf", () => {
    const ergebnis = validatePassword("abc");
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.fehler).toEqual([
      "Mindestens 10 Zeichen",
      "Mindestens ein Grossbuchstabe",
      "Mindestens eine Zahl",
      "Mindestens ein Sonderzeichen",
    ]);
  });

  it("liefert die Regeln für die UI mit", () => {
    expect(validatePassword("abc").regeln.kleinbuchstabe).toBe(true);
  });
});

describe("PASSWORD_RULE_LABELS", () => {
  it("deckt jede Regel genau einmal ab", () => {
    const keys = PASSWORD_RULE_LABELS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(Object.keys(checkPassword(""))));
  });
});
