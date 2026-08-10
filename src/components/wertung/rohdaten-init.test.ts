import { describe, it, expect } from "vitest";
import { initialisiereRohdaten, padRunden, padTuerme } from "./rohdaten-init";

describe("padRunden / padTuerme", () => {
  it("füllt fehlende Einträge mit Nullwerten auf", () => {
    expect(padRunden([{ baelle: 4, strafpunkte: 1 }], 3)).toEqual([
      { baelle: 4, strafpunkte: 1 },
      { baelle: 0, strafpunkte: 0 },
      { baelle: 0, strafpunkte: 0 },
    ]);
    expect(padTuerme([], 2)).toEqual([
      { sektionen: 0, bonus: 0 },
      { sektionen: 0, bonus: 0 },
    ]);
  });
});

describe("initialisiereRohdaten", () => {
  it("runden_strafpunkte: legt volle Rundenliste an", () => {
    const result = initialisiereRohdaten({}, { typ: "runden_strafpunkte", runden: 3 });
    expect(result.runden).toHaveLength(3);
  });

  it("tuerme_punkte: legt Turmliste in Config-Länge an", () => {
    const result = initialisiereRohdaten(
      {},
      {
        typ: "tuerme_punkte",
        tuerme: [
          { name: "Turm 1", sektionen: 3, bonus: 0 },
          { name: "Turm 2", sektionen: 4, bonus: 2 },
        ],
      },
    );
    expect(result.tuerme).toEqual([
      { sektionen: 0, bonus: 0 },
      { sektionen: 0, bonus: 0 },
    ]);
  });

  it("sieg_zuege: initialisiert beide Schlüssel mit 0, ohne Werte zu überschreiben", () => {
    expect(initialisiereRohdaten({}, { typ: "sieg_zuege" })).toEqual({
      siege: 0,
      zuege: 0,
    });
    expect(initialisiereRohdaten({ siege: 2 }, { typ: "sieg_zuege" })).toEqual({
      siege: 2,
      zuege: 0,
    });
  });

  it("verändert das Original nicht (immutable)", () => {
    const original: Record<string, unknown> = {};
    initialisiereRohdaten(original, { typ: "sieg_zuege" });
    expect(original).toEqual({});
  });

  it("lässt unbekannte Typen und fehlende Wertungslogik unangetastet", () => {
    const rohdaten = { wert: 5 };
    expect(initialisiereRohdaten(rohdaten, { typ: "max_value" })).toBe(rohdaten);
    expect(initialisiereRohdaten(rohdaten, null)).toBe(rohdaten);
  });
});
