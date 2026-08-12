import { describe, expect, it } from "vitest";
import { MITTAG_DEFAULT, normalisiereMittagsfenster } from "./mittagsplanung";

describe("normalisiereMittagsfenster", () => {
  it("lässt eine vollständige neue Konfiguration unverändert", () => {
    const fenster = {
      von: "11:00",
      bis: "14:00",
      dauerMin: 45,
      teamsProWelle: 2,
      versatzMin: 15,
    };
    expect(normalisiereMittagsfenster(fenster)).toEqual(fenster);
  });

  it("übersetzt die alte Pausen-Form, statt die Seite auflaufen zu lassen", () => {
    // So sah die Spalte vor dem rollenden Mittag aus.
    const alt = {
      nachRunde: 6,
      dauerMin: 45,
      maxTeamsGleichzeitig: 8,
      versatzMin: 5,
    };
    expect(normalisiereMittagsfenster(alt)).toEqual({
      // Aus einer Rundennummer lässt sich kein Fenster ableiten → Standard
      von: MITTAG_DEFAULT.von,
      bis: MITTAG_DEFAULT.bis,
      // Übernommen, weil direkt übertragbar
      dauerMin: 45,
      teamsProWelle: 8,
      versatzMin: 5,
    });
  });

  it("ersetzt kaputte Einzelwerte durch den Standard", () => {
    expect(
      normalisiereMittagsfenster({
        von: "elf",
        bis: null,
        dauerMin: "viel",
        teamsProWelle: -3,
        versatzMin: undefined,
      }),
    ).toEqual(MITTAG_DEFAULT);
  });

  it("hält Mindestwerte ein", () => {
    const fenster = normalisiereMittagsfenster({ dauerMin: 0, teamsProWelle: 0 })!;
    expect(fenster.dauerMin).toBeGreaterThanOrEqual(5);
    expect(fenster.teamsProWelle).toBeGreaterThanOrEqual(1);
  });

  it("gibt null zurück, wenn keine Mittagskonfiguration hinterlegt ist", () => {
    expect(normalisiereMittagsfenster(null)).toBeNull();
    expect(normalisiereMittagsfenster(undefined)).toBeNull();
    expect(normalisiereMittagsfenster("11:30")).toBeNull();
    expect(normalisiereMittagsfenster(42)).toBeNull();
  });

  it("akzeptiert ein leeres Objekt und füllt komplett auf", () => {
    expect(normalisiereMittagsfenster({})).toEqual(MITTAG_DEFAULT);
  });
});
