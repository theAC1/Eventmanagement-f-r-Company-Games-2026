import { describe, expect, it } from "vitest";
import {
  VERTRAULICHE_WERTUNGS_KEYS,
  sanitizeWertungslogikFuerSchiedsrichter,
  type Wertungslogik,
} from "./wertungslogik-types";

describe("sanitizeWertungslogikFuerSchiedsrichter", () => {
  it("entfernt die Gewichtung aus einer Kleinbegegnungs-Logik", () => {
    const logik = {
      typ: "duell_kleinbegegnungen",
      richtung: "hoechster_gewinnt",
      einheit: "Punkte",
      gewichtungG: 40,
    } as unknown as Wertungslogik;

    const sauber = sanitizeWertungslogikFuerSchiedsrichter(logik) as Record<string, unknown>;
    expect(sauber.gewichtungG).toBeUndefined();
    expect(sauber.typ).toBe("duell_kleinbegegnungen");
    expect(sauber.einheit).toBe("Punkte");
  });

  it("entfernt jeden vertraulichen Schlüssel", () => {
    const logik = Object.fromEntries([
      ["typ", "sieg_zuege"],
      ...VERTRAULICHE_WERTUNGS_KEYS.map((k) => [k, 99]),
    ]) as unknown as Wertungslogik;

    const sauber = sanitizeWertungslogikFuerSchiedsrichter(logik) as Record<string, unknown>;
    for (const key of VERTRAULICHE_WERTUNGS_KEYS) {
      expect(sauber[key]).toBeUndefined();
    }
  });

  it("lässt das Original unangetastet", () => {
    const logik = {
      typ: "sieg_zuege",
      gewichtungSieg: 100,
    } as unknown as Wertungslogik;

    sanitizeWertungslogikFuerSchiedsrichter(logik);
    expect((logik as Record<string, unknown>).gewichtungSieg).toBe(100);
  });

  it("macht aus fehlender Logik null statt eines leeren Objekts", () => {
    expect(sanitizeWertungslogikFuerSchiedsrichter(null)).toBeNull();
    expect(sanitizeWertungslogikFuerSchiedsrichter(undefined)).toBeNull();
  });
});
