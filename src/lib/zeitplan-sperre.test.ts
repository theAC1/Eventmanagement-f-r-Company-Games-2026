import { describe, it, expect } from "vitest";
import {
  LEERE_ABHAENGIGKEITEN,
  gamedayLaeuft,
  pruefeAbhaengigkeiten,
  pruefeGamedaySperre,
  pruefeNeuaufbau,
  warnungen,
} from "./zeitplan-sperre";

describe("gamedayLaeuft", () => {
  it("erkennt TEST und HOT als laufend", () => {
    expect(gamedayLaeuft("TEST")).toBe(true);
    expect(gamedayLaeuft("HOT")).toBe(true);
  });

  it("INAKTIV, null und undefined laufen nicht", () => {
    expect(gamedayLaeuft("INAKTIV")).toBe(false);
    expect(gamedayLaeuft(null)).toBe(false);
    expect(gamedayLaeuft(undefined)).toBe(false);
  });
});

describe("pruefeGamedaySperre", () => {
  it("ohne Gameday ist alles erlaubt", () => {
    for (const a of ["STRUKTUR", "AKTIVIERUNG", "NAME", "LOESCHEN"] as const) {
      expect(pruefeGamedaySperre("INAKTIV", a).erlaubt).toBe(true);
    }
  });

  it("sperrt Struktur, Aktivierung und Löschen im TEST-Modus", () => {
    for (const a of ["STRUKTUR", "AKTIVIERUNG", "LOESCHEN"] as const) {
      const entscheid = pruefeGamedaySperre("TEST", a);
      expect(entscheid.erlaubt).toBe(false);
      expect(entscheid.grund).toContain("Gameday");
    }
  });

  it("sperrt dieselben Änderungen im HOT-Modus", () => {
    expect(pruefeGamedaySperre("HOT", "STRUKTUR").erlaubt).toBe(false);
  });

  it("Umbenennen bleibt auch während des Gamedays erlaubt", () => {
    const entscheid = pruefeGamedaySperre("HOT", "NAME");
    expect(entscheid.erlaubt).toBe(true);
    expect(entscheid.grund).toBeNull();
  });
});

describe("pruefeAbhaengigkeiten", () => {
  it("ohne Abhängigkeiten erlaubt", () => {
    expect(pruefeAbhaengigkeiten(LEERE_ABHAENGIGKEITEN).erlaubt).toBe(true);
  });

  it("QR-Scans blockieren den Neuaufbau", () => {
    const entscheid = pruefeAbhaengigkeiten({
      ...LEERE_ABHAENGIGKEITEN,
      qrScans: 3,
    });
    expect(entscheid.erlaubt).toBe(false);
    expect(entscheid.grund).toContain("3");
  });

  it("Ergebnisse und Einsätze blockieren nicht", () => {
    expect(
      pruefeAbhaengigkeiten({ qrScans: 0, ergebnisse: 12, einsaetze: 40 })
        .erlaubt,
    ).toBe(true);
  });
});

describe("warnungen", () => {
  it("ohne Abhängigkeiten keine Warnung", () => {
    expect(warnungen(LEERE_ABHAENGIGKEITEN)).toEqual([]);
  });

  it("nennt Einsatzplan-Zuweisungen und Ergebnisse mit Anzahl", () => {
    const texte = warnungen({ qrScans: 0, ergebnisse: 5, einsaetze: 9 });
    expect(texte).toHaveLength(2);
    expect(texte[0]).toContain("9");
    expect(texte[1]).toContain("5");
  });
});

describe("pruefeNeuaufbau", () => {
  it("Gameday hat Vorrang vor Abhängigkeiten", () => {
    const entscheid = pruefeNeuaufbau("HOT", { qrScans: 7, ergebnisse: 0, einsaetze: 0 });
    expect(entscheid.erlaubt).toBe(false);
    expect(entscheid.grund).toContain("Gameday");
  });

  it("ohne Gameday greifen die Abhängigkeiten", () => {
    const entscheid = pruefeNeuaufbau("INAKTIV", { qrScans: 7, ergebnisse: 0, einsaetze: 0 });
    expect(entscheid.erlaubt).toBe(false);
    expect(entscheid.grund).toContain("QR-Verifikationen");
  });

  it("sauberer Zustand erlaubt den Neuaufbau", () => {
    expect(pruefeNeuaufbau(null, LEERE_ABHAENGIGKEITEN).erlaubt).toBe(true);
  });
});
